import { test, expect, type Page } from '@playwright/test'
import { setupMockAnvil } from '../helpers/mockAnvil'

async function emitCreateDocxItem(
  page: Page,
  options: { output: unknown; isError: boolean; finish?: boolean },
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
    if (opts.finish) {
      ctl.emitEvent({
        event: {
          type: 'turn.finished',
          ...stamp(5),
          status: 'completed',
          stats: { durationMs: 900, outputTokens: 20 },
        },
      })
    }
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

async function emitRunningCreateDocxTurn(
  page: Page,
  options: {
    itemId?: string
    input?: unknown
    assistantText?: string
    toolName?: string
  } = {},
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
      turnId: 't-running-doc',
      seq: seq++,
      timestamp: new Date().toISOString(),
    })
    ctl.emitEvent({ event: { type: 'turn.started', ...stamp() } })
    if (opts.assistantText) {
      ctl.emitEvent({
        event: { type: 'item.added', ...stamp(), itemId: 'assistant-running', role: 'assistant', kind: 'text' },
      })
      ctl.emitEvent({
        event: { type: 'text.delta', ...stamp(), itemId: 'assistant-running', text: opts.assistantText },
      })
    }
    const itemId = opts.itemId ?? 'tool-running'
    ctl.emitEvent({
      event: { type: 'item.added', ...stamp(), itemId, role: 'tool', kind: 'tool_use' },
    })
    ctl.emitEvent({
      event: {
        type: 'tool.started',
        ...stamp(),
        itemId,
        toolName: opts.toolName ?? 'mcp__anvil__create_docx_from_skill',
        input: opts.input ?? { path: './running-report.docx' },
      },
    })
  }, options)
}

async function finishRunningCreateDocxTurn(
  page: Page,
  options: {
    itemId?: string
    output: unknown
    isError?: boolean
    status?: 'completed' | 'failed' | 'cancelled'
  },
) {
  await page.evaluate((opts) => {
    const ctl = (
      window as unknown as {
        __anvilTestControl: { emitEvent: (env: unknown) => void }
      }
    ).__anvilTestControl
    const stamp = (seq: number) => ({
      sessionId: 's1',
      turnId: 't-running-doc',
      seq,
      timestamp: new Date().toISOString(),
    })
    ctl.emitEvent({
      event: {
        type: 'tool.result',
        ...stamp(20),
        itemId: opts.itemId ?? 'tool-running',
        output: opts.output,
        isError: opts.isError === true,
      },
    })
    ctl.emitEvent({
      event: {
        type: 'turn.finished',
        ...stamp(21),
        status: opts.status ?? (opts.isError === true ? 'failed' : 'completed'),
        stats: { durationMs: 1300, outputTokens: 32 },
      },
    })
  }, options)
}

async function emitMixedArtifactTurn(page: Page) {
  await page.evaluate(() => {
    const ctl = (
      window as unknown as {
        __anvilTestControl: { emitEvent: (env: unknown) => void }
      }
    ).__anvilTestControl
    let seq = 1
    const stamp = () => ({
      sessionId: 's1',
      turnId: 't-mixed-docs',
      seq: seq++,
      timestamp: new Date().toISOString(),
    })
    ctl.emitEvent({ event: { type: 'turn.started', ...stamp() } })

    const startTool = (itemId: string, path: string) => {
      ctl.emitEvent({
        event: { type: 'item.added', ...stamp(), itemId, role: 'tool', kind: 'tool_use' },
      })
      ctl.emitEvent({
        event: {
          type: 'tool.started',
          ...stamp(),
          itemId,
          toolName: 'mcp__anvil__create_docx',
          input: { path },
        },
      })
    }

    startTool('tool-pending', './pending.docx')
    startTool('tool-success', './success-input.docx')
    ctl.emitEvent({
      event: {
        type: 'tool.result',
        ...stamp(),
        itemId: 'tool-success',
        output: [{ type: 'text', text: '已生成 Word 文档：/Users/test/proj/success-output.docx' }],
        isError: false,
      },
    })
    startTool('tool-failed', './failed.docx')
    ctl.emitEvent({
      event: {
        type: 'tool.result',
        ...stamp(),
        itemId: 'tool-failed',
        output: [{ type: 'text', text: '生成文档失败：模板不可用' }],
        isError: true,
      },
    })
  })
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
    finish: true,
  })

  const conversation = page.locator('main')
  await expect(conversation.getByText('out.docx')).toHaveCount(1, { timeout: 5_000 })

  // expand to reveal full + workspace-relative path
  await conversation.getByRole('button', { name: '展开路径' }).click()
  await expect(conversation.getByText('/Users/test/proj/out.docx').first()).toBeVisible()
  await expect(conversation.getByText('./out.docx').first()).toBeVisible()

  // Open goes through the safe IPC with the absolute path
  await conversation.getByRole('button', { name: '打开' }).click()
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
  await conversation.getByRole('button', { name: '定位' }).click()
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

  // the tool step shows (compact, cleaned name), but no generated-file chip
  await expect(page.getByText('create_docx').first()).toBeVisible({ timeout: 5_000 })
  const panel = page.getByTestId('generated-files-panel')
  await expect(panel.getByText('生成 Word 文档失败：out.docx')).toBeVisible()
  await expect(panel.getByText('生成文档失败：文件已存在')).toBeVisible()
  await expect(page.getByRole('button', { name: '打开' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '定位' })).toHaveCount(0)
})

test('running create_docx shows pending generated-file progress and no final answer anchor', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitRunningCreateDocxTurn(page, {
    assistantText: '最终结果：正在生成运行报告。',
    input: { path: './running-report.docx' },
  })

  const panel = page.getByTestId('generated-files-panel')
  await expect(panel.getByText('正在生成 Word 文档：running-report.docx…')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('最终结果：正在生成运行报告。')).toBeVisible()
  await expect(page.getByText('最终回答')).toHaveCount(0)
})

test('successful tool result replaces pending document progress with a real chip', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitRunningCreateDocxTurn(page, {
    input: { path: './draft-name.docx' },
  })
  await expect(page.getByText('正在生成 Word 文档：draft-name.docx…')).toBeVisible({ timeout: 5_000 })

  await finishRunningCreateDocxTurn(page, {
    output: [{ type: 'text', text: '已生成 Word 文档：/Users/test/proj/final-name.docx\n包含 3 个内容块。' }],
  })

  const panel = page.getByTestId('generated-files-panel')
  await expect(panel.getByText('正在生成 Word 文档：draft-name.docx…')).toHaveCount(0)
  await expect(panel.getByText('final-name.docx')).toBeVisible()
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

test('completed turn summary supports multiple generated files and reports errored outputs', async ({ page }) => {
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
  await expect(panel.getByText('生成 Word 文档失败：out-3.docx')).toBeVisible()
  await expect(panel.getByText('生成文档失败：文件已存在 /Users/test/proj/c.docx')).toBeVisible()
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

test('mixed document artifacts render pending, success, and failed rows together', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitMixedArtifactTurn(page)

  const panel = page.getByTestId('generated-files-panel')
  await expect(panel.getByText('正在生成 Word 文档：pending.docx…')).toBeVisible({ timeout: 5_000 })
  await expect(panel.getByText('success-output.docx')).toBeVisible()
  await expect(panel.getByText('生成 Word 文档失败：failed.docx')).toBeVisible()
  await expect(panel.getByText('生成文档失败：模板不可用')).toBeVisible()
})

test('assistant prose paths do not create generated-file chips', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })

  await emitCompletedTurn(page, {
    outputs: [
      {
        output: [{ type: 'text', text: '已生成 Word 文档：/Users/test/proj/real-output.docx\n包含 3 个内容块。' }],
      },
    ],
    finalText: '生成路径：/Users/test/proj/fake-prose.docx',
  })

  const panel = page.getByTestId('generated-files-panel')
  await expect(panel.getByText('real-output.docx')).toBeVisible({ timeout: 5_000 })
  await expect(panel.getByText('fake-prose.docx')).toHaveCount(0)
})
