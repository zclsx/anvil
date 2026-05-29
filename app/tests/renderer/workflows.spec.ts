import { test, expect, type Page } from '@playwright/test'
import { setupMockAnvil } from '../helpers/mockAnvil'

async function dispatchFileDrop(page: Page, selector: string) {
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['fake content'], 'sample.ts', { type: 'text/plain' }))
    return dt
  })
  await page.dispatchEvent(selector, 'dragover', { dataTransfer })
  await page.dispatchEvent(selector, 'drop', { dataTransfer })
}

test.describe('workspace state machine', () => {
  test('app boots into draft workspace when settings.workspacePath is set', async ({ page }) => {
    await setupMockAnvil(page, {
      settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
      workspaceExists: true,
    })
    await page.goto('/')

    await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('draft workspace')).toBeVisible()
  })

  test('change draft workspace via picker', async ({ page }) => {
    await setupMockAnvil(page, {
      settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
      workspaceExists: true,
      pickedDirectory: '/Users/test/other-proj',
    })
    await page.goto('/')

    await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: /更改目录/ }).click()

    await expect(page.getByText(/other-proj/).first()).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('file reference chips', () => {
  test('drag a file adds a chip and notice', async ({ page }) => {
    await setupMockAnvil(page, {
      settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
      workspaceExists: true,
      filePathsForDrop: ['/Users/test/proj/src/sample.ts'],
    })
    await page.goto('/')
    await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

    await dispatchFileDrop(page, 'textarea')

    await expect(page.getByText('sample.ts').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/已添加 1 个文件引用/).first()).toBeVisible()
  })

  test('send with file refs builds Referenced files prompt', async ({ page }) => {
    await setupMockAnvil(page, {
      settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
      workspaceExists: true,
      filePathsForDrop: ['/Users/test/proj/src/a.ts'],
      queryResult: { ok: true, sessionId: 'test-session' },
    })
    await page.goto('/')
    await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

    await dispatchFileDrop(page, 'textarea')
    await expect(page.getByText('a.ts').first()).toBeVisible()

    await page.locator('textarea').fill('look at this file')
    await page.getByRole('button', { name: '发送', exact: true }).click()

    await page.waitForFunction(() => {
      const ctl = (window as unknown as { __anvilTestControl?: { getCalls: (c: string) => unknown[] } }).__anvilTestControl
      return ctl && ctl.getCalls('agent:query').length > 0
    })
    const calls = await page.evaluate(() => {
      const ctl = (window as unknown as { __anvilTestControl: { getCalls: (c: string) => unknown[] } }).__anvilTestControl
      return ctl.getCalls('agent:query')
    })
    expect(calls.length).toBe(1)
    const req = calls[0] as { mode: string; prompt: string; workspacePath?: string }
    expect(req.mode).toBe('new')
    expect(req.prompt).toContain('look at this file')
    expect(req.prompt).toContain('Referenced files:')
    expect(req.prompt).toContain('./src/a.ts')
  })
})

test.describe('failure / restore', () => {
  test('direct send failure restores prompt and file refs', async ({ page }) => {
    await setupMockAnvil(page, {
      settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
      workspaceExists: true,
      filePathsForDrop: ['/Users/test/proj/src/a.ts'],
      queryResult: { ok: false, error: 'mocked upstream failure' },
    })
    await page.goto('/')
    await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

    await dispatchFileDrop(page, 'textarea')
    await page.locator('textarea').fill('this should restore')
    await page.getByRole('button', { name: '发送', exact: true }).click()

    await expect(page.locator('textarea')).toHaveValue('this should restore', { timeout: 5_000 })
    await expect(page.getByText('a.ts').first()).toBeVisible()
    await expect(page.getByText('mocked upstream failure').first()).toBeVisible()
  })
})

test.describe('guards', () => {
  test('switch session is blocked while running', async ({ page }) => {
    await setupMockAnvil(page, {
      settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
      workspaceExists: true,
      sessions: [
        {
          id: 'sess-A',
          workspacePath: '/Users/test/other',
          title: 'Other session',
          firstPrompt: 'hi',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastStatus: 'completed',
          turnCount: 1,
          totalCostUsd: 0,
        },
      ],
      queryDelayMs: 5_000,
      queryResult: { ok: true, sessionId: 'running-session' },
    })
    await page.goto('/')
    await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

    await page.locator('textarea').fill('start a long task')
    await page.getByRole('button', { name: '发送', exact: true }).click()

    await expect(page.getByRole('button', { name: /取消/ })).toBeVisible({ timeout: 5_000 })

    await page.getByText('Other session').click()

    await expect(page.getByText(/请先取消当前任务或等待结束后再切换 session/).first()).toBeVisible({
      timeout: 5_000,
    })
  })
})

test.describe('approval panel', () => {
  test('synthetic approval.requested renders ApprovalCard and decide flows through', async ({ page }) => {
    await setupMockAnvil(page, {
      settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
      workspaceExists: true,
    })
    await page.goto('/')
    await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

    await page.evaluate(() => {
      const ctl = (window as unknown as {
        __anvilTestControl: { emitEvent: (env: unknown) => void }
      }).__anvilTestControl
      ctl.emitEvent({
        event: {
          type: 'approval.requested',
          sessionId: 'sess-x',
          turnId: 'turn-x',
          itemId: 'approval:abc',
          request: {
            approvalId: 'abc',
            toolName: 'Bash',
            input: { command: 'ls' },
            risk: 'high',
          },
          seq: 1,
          timestamp: new Date().toISOString(),
        },
      })
    })

    await expect(page.getByText(/Awaiting Approval/).first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Bash').first()).toBeVisible()
    await expect(page.getByText(/high risk/).first()).toBeVisible()

    await page.getByRole('button', { name: 'Allow once' }).click()

    await page.waitForFunction(() => {
      const ctl = (window as unknown as { __anvilTestControl: { getCalls: (c: string) => unknown[] } }).__anvilTestControl
      return ctl.getCalls('approval:decide').length > 0
    })
    const calls = await page.evaluate(() => {
      const ctl = (window as unknown as { __anvilTestControl: { getCalls: (c: string) => unknown[] } }).__anvilTestControl
      return ctl.getCalls('approval:decide')
    })
    expect(calls.length).toBe(1)
    expect((calls[0] as { decision: string }).decision).toBe('allow')
  })
})
