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

async function emitCompletedTurn(
  page: Page,
  options: {
    outputs: Array<{ toolName?: string; output: unknown; isError?: boolean }>
    finalText?: string
  },
) {
  await page.evaluate((opts) => {
    const ctl = (
      window as unknown as {
        __anvilTestControl: { emitEvent: (env: unknown) => void }
      }
    ).__anvilTestControl
    let seq = 1
    const stamp = () => ({
      sessionId: 's1',
      turnId: 't-artifacts',
      seq: seq++,
      timestamp: new Date().toISOString(),
    })
    ctl.emitEvent({ event: { type: 'turn.started', ...stamp() } })
    opts.outputs.forEach((entry, index) => {
      const itemId = `tool-${index + 1}`
      ctl.emitEvent({
        event: { type: 'item.added', ...stamp(), itemId, role: 'tool', kind: 'tool_use' },
      })
      ctl.emitEvent({
        event: {
          type: 'tool.started',
          ...stamp(),
          itemId,
          toolName: entry.toolName ?? 'mcp__anvil__create_docx',
          input: { path: `./out-${index + 1}.docx` },
        },
      })
      ctl.emitEvent({
        event: {
          type: 'tool.result',
          ...stamp(),
          itemId,
          output: entry.output,
          isError: entry.isError === true,
        },
      })
    })
    if (opts.finalText) {
      ctl.emitEvent({
        event: { type: 'item.added', ...stamp(), itemId: 'assistant-final', role: 'assistant', kind: 'text' },
      })
      ctl.emitEvent({
        event: { type: 'text.delta', ...stamp(), itemId: 'assistant-final', text: opts.finalText },
      })
    }
    ctl.emitEvent({
      event: {
        type: 'turn.finished',
        ...stamp(),
        status: 'completed',
        stats: { durationMs: 1200, outputTokens: 100 },
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

test('successful create_docx is summarized at the bottom of the completed turn', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitCompletedTurn(page, {
    outputs: [
      {
        output: [{ type: 'text', text: '已生成 Word 文档：/Users/test/proj/final-report.docx\n包含 3 个内容块。' }],
      },
    ],
    finalText: '报告已生成。',
  })

  await expect(page.getByText('报告已生成。', { exact: true }).first()).toBeVisible({ timeout: 5_000 })
  const panel = page.getByTestId('generated-files-panel')
  await expect(panel.getByText('生成文件')).toBeVisible()
  await expect(panel.getByText('final-report.docx')).toBeVisible()
})

test('completed turn summary supports multiple generated files and ignores errored outputs', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitCompletedTurn(page, {
    outputs: [
      {
        output: [{ type: 'text', text: '已生成 Word 文档：/Users/test/proj/a.docx\n包含 3 个内容块。' }],
      },
      {
        toolName: 'mcp__anvil__create_docx_from_skill',
        output: [{ type: 'text', text: '已生成 Word 文档：/Users/test/proj/b.docx\n包含 5 个内容块。' }],
      },
      {
        output: [{ type: 'text', text: '生成文档失败：文件已存在 /Users/test/proj/c.docx' }],
        isError: true,
      },
    ],
    finalText: '两个文档已生成。',
  })

  const panel = page.getByTestId('generated-files-panel')
  await expect(panel.getByText('生成文件')).toBeVisible({ timeout: 5_000 })
  await expect(panel.getByText('a.docx')).toBeVisible()
  await expect(panel.getByText('b.docx')).toBeVisible()
  await expect(panel.getByText('c.docx')).toHaveCount(0)
})

test('completed turn without final text still shows generated file fallback area', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitCompletedTurn(page, {
    outputs: [
      {
        output: [{ type: 'text', text: '已生成 Word 文档：/Users/test/proj/no-final.docx\n包含 3 个内容块。' }],
      },
    ],
  })

  const panel = page.getByTestId('generated-files-panel')
  await expect(panel.getByText('生成文件')).toBeVisible({ timeout: 5_000 })
  await expect(panel.getByText('no-final.docx')).toBeVisible()
})
