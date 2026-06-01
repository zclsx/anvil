import { test, expect, type Page } from '@playwright/test'
import { setupMockAnvil } from '../helpers/mockAnvil'

const now = new Date().toISOString()

function promptEvents({
  sessionId,
  turnId,
  seq,
  userItemId,
  answerItemId,
  prompt,
  answer,
}: {
  sessionId: string
  turnId: string
  seq: number
  userItemId: string
  answerItemId: string
  prompt: string
  answer: string
}) {
  return [
    { event: { type: 'turn.started', sessionId, turnId, seq: seq++, timestamp: now } },
    {
      event: {
        type: 'item.added',
        sessionId,
        turnId,
        itemId: userItemId,
        role: 'user',
        kind: 'text',
        seq: seq++,
        timestamp: now,
      },
    },
    {
      event: {
        type: 'text.delta',
        sessionId,
        turnId,
        itemId: userItemId,
        text: prompt,
        seq: seq++,
        timestamp: now,
      },
    },
    {
      event: {
        type: 'item.added',
        sessionId,
        turnId,
        itemId: answerItemId,
        role: 'assistant',
        kind: 'text',
        seq: seq++,
        timestamp: now,
      },
    },
    {
      event: {
        type: 'text.delta',
        sessionId,
        turnId,
        itemId: answerItemId,
        text: answer,
        seq: seq++,
        timestamp: now,
      },
    },
    {
      event: {
        type: 'turn.finished',
        sessionId,
        turnId,
        status: 'completed',
        stats: { durationMs: 800, outputTokens: 12 },
        seq,
        timestamp: now,
      },
    },
  ]
}

async function emitPromptTurn(page: Page, prompt: string, answer: string) {
  await page.evaluate(({ promptText, answerText }) => {
    const ctl = (window as unknown as {
      __anvilTestControl: { emitEvent: (env: unknown) => void }
    }).__anvilTestControl
    const events = [
      {
        event: {
          type: 'turn.started',
          sessionId: 'live-session',
          turnId: 'turn-live',
          seq: 1,
          timestamp: new Date().toISOString(),
        },
      },
      {
        event: {
          type: 'item.added',
          sessionId: 'live-session',
          turnId: 'turn-live',
          itemId: 'user-live',
          role: 'user',
          kind: 'text',
          seq: 2,
          timestamp: new Date().toISOString(),
        },
      },
      {
        event: {
          type: 'text.delta',
          sessionId: 'live-session',
          turnId: 'turn-live',
          itemId: 'user-live',
          text: promptText,
          seq: 3,
          timestamp: new Date().toISOString(),
        },
      },
      {
        event: {
          type: 'item.added',
          sessionId: 'live-session',
          turnId: 'turn-live',
          itemId: 'answer-live',
          role: 'assistant',
          kind: 'text',
          seq: 4,
          timestamp: new Date().toISOString(),
        },
      },
      {
        event: {
          type: 'text.delta',
          sessionId: 'live-session',
          turnId: 'turn-live',
          itemId: 'answer-live',
          text: answerText,
          seq: 5,
          timestamp: new Date().toISOString(),
        },
      },
      {
        event: {
          type: 'turn.finished',
          sessionId: 'live-session',
          turnId: 'turn-live',
          status: 'completed',
          stats: { durationMs: 900, outputTokens: 20 },
          seq: 6,
          timestamp: new Date().toISOString(),
        },
      },
    ]
    for (const event of events) ctl.emitEvent(event)
  }, { promptText: prompt, answerText: answer })
}

test('persisted user prompt renders before the assistant answer and stays after completion', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitPromptTurn(page, '请总结这个项目的风险', '风险总结已完成。')

  await expect(page.getByText('用户输入').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('请总结这个项目的风险')).toBeVisible()
  await expect(page.getByText('最终回答').first()).toBeVisible()
  await expect(page.getByText('风险总结已完成。')).toBeVisible()
  await expect(page.locator('text=用户输入').first()).toBeVisible()

  const userBeforeAnswer = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('div'))
    const user = labels.find((el) => el.textContent?.trim() === '用户输入')
    const answer = labels.find((el) => el.textContent?.trim() === '最终回答')
    if (!user || !answer) return false
    return Boolean(user.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  expect(userBeforeAnswer).toBe(true)
})

test('multi-turn replay keeps user prompts interleaved with answers', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
    sessions: [
      {
        id: 'multi-turn',
        workspacePath: '/Users/test/proj',
        title: '历史会话',
        firstPrompt: '第一问',
        createdAt: now,
        updatedAt: now,
        lastStatus: 'completed',
        turnCount: 2,
        totalCostUsd: 0,
      },
    ],
    sessionEvents: [
      ...promptEvents({
        sessionId: 'multi-turn',
        turnId: 'turn-1',
        seq: 1,
        userItemId: 'user-1',
        answerItemId: 'answer-1',
        prompt: '第一问',
        answer: '第一答',
      }),
      ...promptEvents({
        sessionId: 'multi-turn',
        turnId: 'turn-2',
        seq: 7,
        userItemId: 'user-2',
        answerItemId: 'answer-2',
        prompt: '第二问',
        answer: '第二答',
      }),
    ],
  })
  await page.goto('/')
  await expect(page.getByText('历史会话')).toBeVisible({ timeout: 5_000 })

  await page.getByText('历史会话').click()

  for (const text of ['第一问', '第一答', '第二问', '第二答']) {
    await expect(page.getByText(text, { exact: true })).toBeVisible({ timeout: 5_000 })
  }

  const order = await page.evaluate(() =>
    ['第一问', '第一答', '第二问', '第二答'].map((text) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let index = 0
      while (walker.nextNode()) {
        const node = walker.currentNode
        if (node.textContent?.trim() === text) return index
        index++
      }
      return -1
    }),
  )
  expect(order.every((index) => index >= 0)).toBe(true)
  expect(order).toEqual([...order].sort((a, b) => a - b))
})

test('session replay renders persisted user prompt items', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
    sessions: [
      {
        id: 'replay-user-prompt',
        workspacePath: '/Users/test/proj',
        title: 'Replay session',
        firstPrompt: '回放里的问题',
        createdAt: now,
        updatedAt: now,
        lastStatus: 'completed',
        turnCount: 1,
        totalCostUsd: 0,
      },
    ],
    sessionEvents: promptEvents({
      sessionId: 'replay-user-prompt',
      turnId: 'turn-replay',
      seq: 1,
      userItemId: 'user-replay',
      answerItemId: 'answer-replay',
      prompt: '回放里的问题',
      answer: '回放里的回答',
    }),
  })
  await page.goto('/')
  await expect(page.getByText('Replay session')).toBeVisible({ timeout: 5_000 })

  await page.getByText('Replay session').click()

  await expect(page.getByText('用户输入').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('回放里的问题')).toBeVisible()
  await expect(page.getByText('回放里的回答')).toBeVisible()
})

test('new send keeps optimistic prompt visible before the next persisted turn starts', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
    queryDelayMs: 1_000,
    queryResult: { ok: true, sessionId: 'existing-session' },
    sessions: [
      {
        id: 'existing-session',
        workspacePath: '/Users/test/proj',
        title: 'Existing session',
        firstPrompt: '上一轮问题',
        createdAt: now,
        updatedAt: now,
        lastStatus: 'completed',
        turnCount: 1,
        totalCostUsd: 0,
      },
    ],
    sessionEvents: promptEvents({
      sessionId: 'existing-session',
      turnId: 'turn-existing',
      seq: 1,
      userItemId: 'user-existing',
      answerItemId: 'answer-existing',
      prompt: '上一轮问题',
      answer: '上一轮回答',
    }),
  })
  await page.goto('/')
  await expect(page.getByText('Existing session')).toBeVisible({ timeout: 5_000 })

  await page.getByText('Existing session').click()
  await expect(page.getByText('上一轮问题')).toBeVisible({ timeout: 5_000 })

  await page.locator('textarea').fill('新的追问')
  await page.getByRole('button', { name: '发送', exact: true }).click()

  await expect(page.getByText('新的追问')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('button', { name: /取消/ })).toBeVisible({ timeout: 5_000 })
})
