import { test, expect, type Page } from '@playwright/test'
import { setupMockAnvil } from '../helpers/mockAnvil'

async function emitToolThenAnswer(page: Page) {
  await page.evaluate(() => {
    const ctl = (
      window as unknown as { __anvilTestControl: { emitEvent: (env: unknown) => void } }
    ).__anvilTestControl
    const stamp = (seq: number) => ({
      sessionId: 's1',
      turnId: 't1',
      seq,
      timestamp: new Date().toISOString(),
    })
    ctl.emitEvent({ event: { type: 'turn.started', ...stamp(1) } })
    ctl.emitEvent({ event: { type: 'item.added', ...stamp(2), itemId: 'user1', role: 'user', kind: 'text' } })
    ctl.emitEvent({ event: { type: 'text.delta', ...stamp(3), itemId: 'user1', text: '请读取文档。' } })
    ctl.emitEvent({ event: { type: 'item.added', ...stamp(4), itemId: 'thinking1', role: 'assistant', kind: 'thinking' } })
    ctl.emitEvent({ event: { type: 'text.delta', ...stamp(5), itemId: 'thinking1', text: '需要先读文件。' } })
    ctl.emitEvent({ event: { type: 'item.added', ...stamp(6), itemId: 'mid', role: 'assistant', kind: 'text' } })
    ctl.emitEvent({ event: { type: 'text.delta', ...stamp(7), itemId: 'mid', text: '我先检查文档内容。' } })
    ctl.emitEvent({ event: { type: 'item.added', ...stamp(8), itemId: 'tool1', role: 'tool', kind: 'tool_use' } })
    ctl.emitEvent({
      event: {
        type: 'tool.started',
        ...stamp(9),
        itemId: 'tool1',
        toolName: 'mcp__anvil__read_document',
        input: { path: './doc.docx' },
      },
    })
    ctl.emitEvent({
      event: {
        type: 'tool.result',
        ...stamp(10),
        itemId: 'tool1',
        output: [{ type: 'text', text: 'first line of output\nSECRET_DETAIL_LINE_42\nmore' }],
        isError: false,
      },
    })
    ctl.emitEvent({ event: { type: 'item.added', ...stamp(11), itemId: 'ans', role: 'assistant', kind: 'text' } })
    ctl.emitEvent({ event: { type: 'text.delta', ...stamp(12), itemId: 'ans', text: '这是最终回答。' } })
    ctl.emitEvent({
      event: { type: 'turn.finished', ...stamp(13), status: 'completed', stats: { durationMs: 1000, outputTokens: 10 } },
    })
  })
}

test('completed turn folds process by default and keeps user plus final answer visible', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitToolThenAnswer(page)

  await expect(page.getByText('请读取文档。')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('这是最终回答。')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('最终回答', { exact: true })).toHaveCount(1)
  await expect(page.getByText('read_document')).toHaveCount(0)
  await expect(page.getByText('我先检查文档内容。')).toHaveCount(0)
  await expect(page.getByText('SECRET_DETAIL_LINE_42')).toHaveCount(0)

  await page.getByRole('button', { name: /^过程/ }).click()
  await expect(page.getByText('read_document').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('我先检查文档内容。')).toBeVisible()
  await expect(page.getByText('回复')).toBeVisible()
  await expect(page.getByText('SECRET_DETAIL_LINE_42')).toHaveCount(0)

  await page.getByText('read_document').first().click()
  await expect(page.getByText('SECRET_DETAIL_LINE_42')).toBeVisible({ timeout: 5_000 })
})

test('expand-process toggle controls the turn process fold without opening tool detail', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitToolThenAnswer(page)
  await expect(page.getByText('read_document')).toHaveCount(0)
  await expect(page.getByText('SECRET_DETAIL_LINE_42')).toHaveCount(0)

  await page.getByRole('button', { name: /展开过程/ }).click()
  await expect(page.getByText('read_document').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('SECRET_DETAIL_LINE_42')).toHaveCount(0)

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+E' : 'Control+E')
  await expect(page.getByText('read_document')).toHaveCount(0)
})

test('running turn shows process live and collapses it when completed', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await page.evaluate(() => {
    const ctl = (
      window as unknown as { __anvilTestControl: { emitEvent: (env: unknown) => void } }
    ).__anvilTestControl
    const stamp = (seq: number) => ({
      sessionId: 's1',
      turnId: 't-running',
      seq,
      timestamp: new Date().toISOString(),
    })
    ctl.emitEvent({ event: { type: 'turn.started', ...stamp(1) } })
    ctl.emitEvent({ event: { type: 'item.added', ...stamp(2), itemId: 'tool-running', role: 'tool', kind: 'tool_use' } })
    ctl.emitEvent({
      event: {
        type: 'tool.started',
        ...stamp(3),
        itemId: 'tool-running',
        toolName: 'Bash',
        input: { command: 'pwd' },
      },
    })
  })

  await expect(page.getByText('Bash').first()).toBeVisible({ timeout: 5_000 })

  await page.evaluate(() => {
    const ctl = (
      window as unknown as { __anvilTestControl: { emitEvent: (env: unknown) => void } }
    ).__anvilTestControl
    const stamp = (seq: number) => ({
      sessionId: 's1',
      turnId: 't-running',
      seq,
      timestamp: new Date().toISOString(),
    })
    ctl.emitEvent({
      event: {
        type: 'tool.result',
        ...stamp(4),
        itemId: 'tool-running',
        output: [{ type: 'text', text: '/Users/test/proj' }],
        isError: false,
      },
    })
    ctl.emitEvent({ event: { type: 'item.added', ...stamp(5), itemId: 'answer-running', role: 'assistant', kind: 'text' } })
    ctl.emitEvent({ event: { type: 'text.delta', ...stamp(6), itemId: 'answer-running', text: '命令已完成。' } })
    ctl.emitEvent({
      event: { type: 'turn.finished', ...stamp(7), status: 'completed', stats: { durationMs: 500, outputTokens: 5 } },
    })
  })

  await expect(page.getByText('命令已完成。')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('Bash')).toHaveCount(0)
})
