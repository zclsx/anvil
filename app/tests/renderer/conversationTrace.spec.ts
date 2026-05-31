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
    ctl.emitEvent({ event: { type: 'item.added', ...stamp(2), itemId: 'tool1', role: 'tool', kind: 'tool_use' } })
    ctl.emitEvent({
      event: {
        type: 'tool.started',
        ...stamp(3),
        itemId: 'tool1',
        toolName: 'mcp__anvil__read_document',
        input: { path: './doc.docx' },
      },
    })
    ctl.emitEvent({
      event: {
        type: 'tool.result',
        ...stamp(4),
        itemId: 'tool1',
        output: [{ type: 'text', text: 'first line of output\nSECRET_DETAIL_LINE_42\nmore' }],
        isError: false,
      },
    })
    ctl.emitEvent({ event: { type: 'item.added', ...stamp(5), itemId: 'ans', role: 'assistant', kind: 'text' } })
    ctl.emitEvent({ event: { type: 'text.delta', ...stamp(6), itemId: 'ans', text: '这是最终回答。' } })
    ctl.emitEvent({
      event: { type: 'turn.finished', ...stamp(7), status: 'completed', stats: { durationMs: 1000, outputTokens: 10 } },
    })
  })
}

test('tool step is compact by default and expands in place to reveal detail', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitToolThenAnswer(page)

  await expect(page.getByText('这是最终回答。')).toBeVisible({ timeout: 5_000 })
  // cleaned tool name shows (compact), but the deep output is hidden by default
  await expect(page.getByText('read_document').first()).toBeVisible()
  await expect(page.getByText('SECRET_DETAIL_LINE_42')).toHaveCount(0)

  // clicking the compact step expands it to the full output
  await page.getByText('read_document').first().click()
  await expect(page.getByText('SECRET_DETAIL_LINE_42')).toBeVisible({ timeout: 5_000 })
})

test('expand-process toggle reveals tool detail across the conversation', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitToolThenAnswer(page)
  await expect(page.getByText('SECRET_DETAIL_LINE_42')).toHaveCount(0)

  await page.getByRole('button', { name: /展开过程/ }).click()
  await expect(page.getByText('SECRET_DETAIL_LINE_42')).toBeVisible({ timeout: 5_000 })
})
