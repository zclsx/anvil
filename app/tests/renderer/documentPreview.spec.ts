import { test, expect, type Page } from '@playwright/test'
import { setupMockAnvil } from '../helpers/mockAnvil'

async function emitCreateDocx(page: Page, absPath: string) {
  await page.evaluate((p) => {
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
    ctl.emitEvent({
      event: { type: 'item.added', ...stamp(2), itemId: 'tool1', role: 'tool', kind: 'tool_use' },
    })
    ctl.emitEvent({
      event: {
        type: 'tool.started',
        ...stamp(3),
        itemId: 'tool1',
        toolName: 'mcp__anvil__create_docx',
        input: { path: './out.docx' },
      },
    })
    ctl.emitEvent({
      event: {
        type: 'tool.result',
        ...stamp(4),
        itemId: 'tool1',
        output: [{ type: 'text', text: `已生成 Word 文档：${p}\n包含 1 个内容块。` }],
        isError: false,
      },
    })
    ctl.emitEvent({
      event: {
        type: 'turn.finished',
        ...stamp(5),
        status: 'completed',
        stats: { durationMs: 800, outputTokens: 10 },
      },
    })
  }, absPath)
}

test('preview button opens a preview tab and reads the docx by absolute path', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitCreateDocx(page, '/Users/test/proj/out.docx')
  await expect(page.getByText('out.docx').first()).toBeVisible({ timeout: 5_000 })

  await page.getByRole('button', { name: '预览' }).first().click()

  // the preview tab mounts DocumentPreview, which reads the docx via the safe IPC
  await page.waitForFunction(() => {
    const ctl = (window as unknown as { __anvilTestControl: { getCalls: (c: string) => unknown[] } }).__anvilTestControl
    return ctl.getCalls('files:readDocxBytes').length > 0
  })
  const calls = await page.evaluate(() => {
    const ctl = (window as unknown as { __anvilTestControl: { getCalls: (c: string) => unknown[] } }).__anvilTestControl
    return ctl.getCalls('files:readDocxBytes')
  })
  expect(calls[0]).toBe('/Users/test/proj/out.docx')

  // mock returns ok:false → preview shows its error state (proves the tab + DocumentPreview rendered)
  await expect(page.getByText('预览失败：mock 预览不可用')).toBeVisible({ timeout: 5_000 })

  // closing the tab tears the preview down
  await page.getByRole('button', { name: '关闭标签' }).first().click()
  await expect(page.getByText('预览失败：mock 预览不可用')).toHaveCount(0)
})
