import { test, expect, type Page } from '@playwright/test'
import { setupMockAnvil } from '../helpers/mockAnvil'

async function emitCreateDocxItem(
  page: Page,
  options: { output: unknown; isError: boolean },
) {
  await page.evaluate((opts) => {
    const ctl = (
      window as unknown as {
        __anvilTestControl: { emitEvent: (env: unknown) => void }
      }
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
        output: opts.output,
        isError: opts.isError,
      },
    })
  }, options)
}

test('successful create_docx renders a generated file chip with working actions', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitCreateDocxItem(page, {
    output: [{ type: 'text', text: '已生成 Word 文档：/Users/test/proj/out.docx\n包含 3 个内容块。' }],
    isError: false,
  })

  await expect(page.getByText('out.docx').first()).toBeVisible({ timeout: 5_000 })

  // expand to reveal full + workspace-relative path
  await page.getByRole('button', { name: '展开路径' }).click()
  await expect(page.getByText('/Users/test/proj/out.docx').first()).toBeVisible()
  await expect(page.getByText('./out.docx').first()).toBeVisible()

  // Open goes through the safe IPC with the absolute path
  await page.getByRole('button', { name: '打开' }).click()
  await page.waitForFunction(() => {
    const ctl = (window as unknown as { __anvilTestControl: { getCalls: (c: string) => unknown[] } }).__anvilTestControl
    return ctl.getCalls('files:openPath').length > 0
  })
  const openCalls = await page.evaluate(() => {
    const ctl = (window as unknown as { __anvilTestControl: { getCalls: (c: string) => unknown[] } }).__anvilTestControl
    return ctl.getCalls('files:openPath')
  })
  expect(openCalls[0]).toBe('/Users/test/proj/out.docx')

  // Reveal too
  await page.getByRole('button', { name: '定位' }).click()
  await page.waitForFunction(() => {
    const ctl = (window as unknown as { __anvilTestControl: { getCalls: (c: string) => unknown[] } }).__anvilTestControl
    return ctl.getCalls('files:showInFolder').length > 0
  })
})

test('errored create_docx does not render a chip', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitCreateDocxItem(page, {
    output: [{ type: 'text', text: '生成文档失败：文件已存在' }],
    isError: true,
  })

  // the tool card shows, but no generated-file chip (no Open/Reveal actions)
  await expect(page.getByText('mcp__anvil__create_docx').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('button', { name: '打开' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '定位' })).toHaveCount(0)
})
