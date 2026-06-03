import { describe, expect, test } from 'vitest'
import type { Item, Turn } from '../../src/store'
import { splitTurnItems } from '../../src/lib/trace'

function item(id: string, role: Item['role'], kind: Item['kind'], text = ''): Item {
  return {
    id,
    role,
    kind,
    text,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function turn(itemIds: string[], status: Turn['status'] = 'completed'): Pick<Turn, 'itemIds' | 'status'> {
  return { itemIds, status }
}

describe('splitTurnItems', () => {
  test('keeps user items first and treats only the last assistant text as final answer', () => {
    const items = {
      user: item('user', 'user', 'text', '问题'),
      thinking: item('thinking', 'assistant', 'thinking', '分析'),
      firstText: item('firstText', 'assistant', 'text', '中间回复'),
      tool: item('tool', 'tool', 'tool_use'),
      final: item('final', 'assistant', 'text', '最终回复'),
    }

    const result = splitTurnItems(turn(['user', 'thinking', 'firstText', 'tool', 'final']), items)

    expect(result.userItems.map((i) => i.id)).toEqual(['user'])
    expect(result.processItems.map((i) => i.id)).toEqual(['thinking', 'firstText', 'tool'])
    expect(result.finalAnswer?.id).toBe('final')
  })

  test('handles turns without final assistant text', () => {
    const items = {
      user: item('user', 'user', 'text', '问题'),
      tool: item('tool', 'tool', 'tool_use'),
    }

    const result = splitTurnItems(turn(['user', 'missing', 'tool']), items)

    expect(result.userItems.map((i) => i.id)).toEqual(['user'])
    expect(result.processItems.map((i) => i.id)).toEqual(['tool'])
    expect(result.finalAnswer).toBeNull()
  })

  test('keeps assistant text in process while the turn is running', () => {
    const items = {
      user: item('user', 'user', 'text', '问题'),
      text: item('text', 'assistant', 'text', '正在生成文档'),
      tool: item('tool', 'tool', 'tool_use'),
    }

    const result = splitTurnItems(turn(['user', 'text', 'tool'], 'running'), items)

    expect(result.userItems.map((i) => i.id)).toEqual(['user'])
    expect(result.processItems.map((i) => i.id)).toEqual(['text', 'tool'])
    expect(result.finalAnswer).toBeNull()
  })
})
