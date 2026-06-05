import { test, expect } from 'vitest'
import type { Item, PendingApproval, Turn } from '../../src/store'
import { deriveTaskWorkbenchModel } from '../../src/lib/taskWorkbench'

function turn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: 'turn-1',
    itemIds: [],
    status: 'running',
    startedAt: '2026-06-05T00:00:00.000Z',
    ...overrides,
  }
}

function toolItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'tool-1',
    role: 'assistant',
    kind: 'tool_use',
    text: '',
    toolName: 'Bash',
    toolInput: { command: 'ls -la' },
    createdAt: '2026-06-05T00:00:01.000Z',
    ...overrides,
  }
}

function textItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'text-1',
    role: 'assistant',
    kind: 'text',
    text: '见 /ws/fake.docx',
    createdAt: '2026-06-05T00:00:02.000Z',
    ...overrides,
  }
}

function approval(overrides: Partial<PendingApproval> = {}): PendingApproval {
  return {
    approvalId: 'approval-1',
    itemId: 'tool-1',
    toolName: 'Bash',
    input: { command: 'npm test' },
    risk: 'high',
    createdAt: '2026-06-05T00:00:03.000Z',
    ...overrides,
  }
}

test.describe('deriveTaskWorkbenchModel', () => {
  test('returns an idle model without turns', () => {
    const model = deriveTaskWorkbenchModel({ turns: [], items: {}, pendingApprovals: [] })
    expect(model.status).toBe('idle')
    expect(model.label).toBe('空闲')
    expect(model.toolRuns).toEqual([])
    expect(model.artifacts).toEqual([])
  })

  test('prefers the latest running turn and marks unfinished tools as running', () => {
    const model = deriveTaskWorkbenchModel({
      turns: [
        turn({ id: 'old', status: 'completed', itemIds: [] }),
        turn({ id: 'running', status: 'running', itemIds: ['tool-1'] }),
      ],
      items: { 'tool-1': toolItem() },
      pendingApprovals: [],
    })

    expect(model.activeTurn?.id).toBe('running')
    expect(model.status).toBe('running')
    expect(model.label).toBe('工具运行中')
    expect(model.toolRuns).toMatchObject([
      { itemId: 'tool-1', label: 'Bash', status: 'running', statusLabel: '运行中', tone: 'running' },
    ])
  })

  test('approval state overrides the normal running label', () => {
    const model = deriveTaskWorkbenchModel({
      turns: [turn({ itemIds: ['tool-1'] })],
      items: { 'tool-1': toolItem({ approvalId: 'approval-1' }) },
      pendingApprovals: [approval()],
    })

    expect(model.status).toBe('awaitingApproval')
    expect(model.label).toBe('等待审批')
    expect(model.toolRuns[0]).toMatchObject({
      status: 'pendingApproval',
      statusLabel: '待审批',
      tone: 'warning',
      risk: 'high',
    })
  })

  test('derives generated file artifacts from tool output only', () => {
    const model = deriveTaskWorkbenchModel({
      turns: [turn({ status: 'completed', itemIds: ['assistant', 'docx'] })],
      items: {
        assistant: textItem({ id: 'assistant' }),
        docx: toolItem({
          id: 'docx',
          toolName: 'mcp__anvil__create_docx',
          toolInput: { path: './draft.docx' },
          toolOutput: [{ type: 'text', text: '已生成 Word 文档：/ws/final.docx\n包含 1 个内容块。' }],
          toolIsError: false,
        }),
      },
      pendingApprovals: [],
    })

    expect(model.status).toBe('completed')
    expect(model.label).toBe('已完成')
    expect(model.artifacts).toEqual([
      { itemId: 'docx', status: 'success', name: 'final.docx', path: '/ws/final.docx' },
    ])
  })

  test('reports failed and cancelled turns distinctly', () => {
    const failed = deriveTaskWorkbenchModel({
      turns: [turn({ status: 'failed', itemIds: ['tool-1'] })],
      items: { 'tool-1': toolItem({ toolOutput: [{ type: 'text', text: 'boom' }], toolIsError: true }) },
      pendingApprovals: [],
    })
    const cancelled = deriveTaskWorkbenchModel({
      turns: [turn({ status: 'cancelled' })],
      items: {},
      pendingApprovals: [],
    })

    expect(failed).toMatchObject({ status: 'failed', label: '失败', tone: 'danger' })
    expect(failed.toolRuns[0]).toMatchObject({ status: 'failed', statusLabel: '错误' })
    expect(cancelled).toMatchObject({ status: 'cancelled', label: '已取消', tone: 'danger' })
  })
})
