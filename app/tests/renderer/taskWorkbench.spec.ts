import { test, expect, type Page } from '@playwright/test'
import { setupMockAnvil } from '../helpers/mockAnvil'

async function boot(page: Page) {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
  })
  await page.goto('/')
  await expect(page.getByText('Workspace 已就绪：').first()).toBeVisible({ timeout: 5_000 })
}

async function emitRunningTool(page: Page) {
  await page.evaluate(() => {
    const ctl = (window as unknown as {
      __anvilTestControl: { emitEvent: (env: unknown) => void }
    }).__anvilTestControl
    const stamp = (seq: number) => ({
      sessionId: 's-task',
      turnId: 't-task',
      seq,
      timestamp: new Date().toISOString(),
    })
    ctl.emitEvent({ event: { type: 'turn.started', ...stamp(1) } })
    ctl.emitEvent({
      event: { type: 'item.added', ...stamp(2), itemId: 'tool-task', role: 'tool', kind: 'tool_use' },
    })
    ctl.emitEvent({
      event: {
        type: 'tool.started',
        ...stamp(3),
        itemId: 'tool-task',
        toolName: 'Bash',
        input: { command: 'npm test' },
      },
    })
  })
}

async function emitGeneratedFile(page: Page) {
  await page.evaluate(() => {
    const ctl = (window as unknown as {
      __anvilTestControl: { emitEvent: (env: unknown) => void }
    }).__anvilTestControl
    const stamp = (seq: number) => ({
      sessionId: 's-doc',
      turnId: 't-doc',
      seq,
      timestamp: new Date().toISOString(),
    })
    ctl.emitEvent({ event: { type: 'turn.started', ...stamp(1) } })
    ctl.emitEvent({
      event: { type: 'item.added', ...stamp(2), itemId: 'tool-doc', role: 'tool', kind: 'tool_use' },
    })
    ctl.emitEvent({
      event: {
        type: 'tool.started',
        ...stamp(3),
        itemId: 'tool-doc',
        toolName: 'mcp__anvil__create_docx',
        input: { path: './draft.docx' },
      },
    })
    ctl.emitEvent({
      event: {
        type: 'tool.result',
        ...stamp(4),
        itemId: 'tool-doc',
        output: [{ type: 'text', text: '已生成 Word 文档：/Users/test/proj/final.docx\n包含 1 个内容块。' }],
        isError: false,
      },
    })
    ctl.emitEvent({
      event: {
        type: 'turn.finished',
        ...stamp(5),
        status: 'completed',
        stats: { durationMs: 1000, outputTokens: 20 },
      },
    })
  })
}

test.describe('right panel task workbench', () => {
  test('defaults to the task workbench instead of an empty inspector', async ({ page }) => {
    await boot(page)

    const panel = page.locator('aside')
    await expect(panel.getByRole('button', { name: '任务' })).toBeVisible()
    await expect(panel.getByText('当前任务', { exact: true })).toBeVisible()
    await expect(panel.getByText('空闲')).toBeVisible()
    await expect(panel.getByText('发送指令后，这里会显示当前任务、工具运行和生成文件。')).toBeVisible()
  })

  test('shows running tool state and opens the inspector from a tool row', async ({ page }) => {
    await boot(page)
    await emitRunningTool(page)

    const panel = page.locator('aside')
    await expect(panel.getByText('工具运行中')).toBeVisible({ timeout: 5_000 })
    await expect(panel.getByRole('button', { name: /Bash.*npm test/ })).toBeVisible()

    await panel.getByRole('button', { name: /Bash/ }).click()
    await expect(panel.getByRole('button', { name: '详情' })).toBeVisible()
    await expect(panel.getByText('输入')).toBeVisible()
    await expect(panel.getByText('"npm test"', { exact: true })).toBeVisible()
  })

  test('shows generated files in the task workbench', async ({ page }) => {
    await boot(page)
    await emitGeneratedFile(page)

    const panel = page.locator('aside')
    await expect(panel.getByText('已完成')).toBeVisible({ timeout: 5_000 })
    await expect(panel.getByText('生成了 1 个文件')).toBeVisible()
    await expect(panel.getByText('final.docx', { exact: true })).toBeVisible()
    await expect(panel.getByRole('button', { name: '预览' })).toBeVisible()
  })
})
