import { test, expect } from 'vitest'
import {
  parseCreatedDocxPath,
  getGeneratedDocxPath,
  getGeneratedDocxArtifactsForTurn,
} from '../../src/lib/generatedFiles'

test.describe('parseCreatedDocxPath', () => {
  test('parses an absolute posix path from create_docx text output', () => {
    const out = [{ type: 'text', text: '已生成 Word 文档：/Users/a1-6/AnvilDocxE2E/create-docx-e2e.docx\n包含 5 个内容块。' }]
    expect(parseCreatedDocxPath(out)).toBe('/Users/a1-6/AnvilDocxE2E/create-docx-e2e.docx')
  })

  test('parses from a plain string output', () => {
    expect(parseCreatedDocxPath('已生成 Word 文档：/tmp/report.docx\n包含 1 个内容块。')).toBe('/tmp/report.docx')
  })

  test('parses a content-wrapped object output', () => {
    const out = { content: [{ type: 'text', text: '已生成 Word 文档：/a/b/c.docx\n包含 2 个内容块。' }] }
    expect(parseCreatedDocxPath(out)).toBe('/a/b/c.docx')
  })

  test('parses a windows path', () => {
    const out = [{ type: 'text', text: '已生成 Word 文档：E:\\foo\\bar.docx\n包含 3 个内容块。' }]
    expect(parseCreatedDocxPath(out)).toBe('E:\\foo\\bar.docx')
  })

  test('handles a path with spaces', () => {
    const out = [{ type: 'text', text: '已生成 Word 文档：/Users/a1-6/My Docs/report.docx\n包含 1 个内容块。' }]
    expect(parseCreatedDocxPath(out)).toBe('/Users/a1-6/My Docs/report.docx')
  })

  test('returns null when there is no .docx path', () => {
    expect(parseCreatedDocxPath([{ type: 'text', text: '生成失败：文件不存在' }])).toBeNull()
    expect(parseCreatedDocxPath('')).toBeNull()
    expect(parseCreatedDocxPath(null)).toBeNull()
  })

  test('ignores non-docx paths', () => {
    expect(parseCreatedDocxPath([{ type: 'text', text: '/tmp/note.txt' }])).toBeNull()
  })
})

test.describe('getGeneratedDocxPath', () => {
  const okOutput = [{ type: 'text', text: '已生成 Word 文档：/ws/out.docx\n包含 1 个内容块。' }]

  test('returns the path for a successful create_docx item', () => {
    expect(
      getGeneratedDocxPath({ toolName: 'mcp__anvil__create_docx', toolOutput: okOutput, toolIsError: false }),
    ).toBe('/ws/out.docx')
  })

  test('returns null when the tool errored', () => {
    expect(
      getGeneratedDocxPath({ toolName: 'mcp__anvil__create_docx', toolOutput: okOutput, toolIsError: true }),
    ).toBeNull()
  })

  test('returns null for a different tool', () => {
    expect(
      getGeneratedDocxPath({ toolName: 'Bash', toolOutput: okOutput, toolIsError: false }),
    ).toBeNull()
  })

  test('returns null when output has no path', () => {
    expect(
      getGeneratedDocxPath({ toolName: 'mcp__anvil__create_docx', toolOutput: [{ type: 'text', text: 'done' }], toolIsError: false }),
    ).toBeNull()
  })

  test('also recognizes create_docx_from_skill output', () => {
    const out = [{ type: 'text', text: '已生成 Word 文档：/ws/report.docx\n使用文档 skill：default-report\n包含 4 个内容块。' }]
    expect(
      getGeneratedDocxPath({ toolName: 'mcp__anvil__create_docx_from_skill', toolOutput: out, toolIsError: false }),
    ).toBe('/ws/report.docx')
  })
})

test.describe('getGeneratedDocxArtifactsForTurn', () => {
  test('derives pending, success, and failed artifacts from tool items', () => {
    const artifacts = getGeneratedDocxArtifactsForTurn(
      { itemIds: ['pending', 'success', 'failed'] },
      {
        pending: {
          id: 'pending',
          toolName: 'mcp__anvil__create_docx_from_skill',
          toolInput: { path: './pending-report.docx' },
          toolOutput: undefined,
          toolIsError: false,
        },
        success: {
          id: 'success',
          toolName: 'mcp__anvil__create_docx',
          toolInput: { path: './input-name.docx' },
          toolOutput: [{ type: 'text', text: '已生成 Word 文档：/ws/output-name.docx\n包含 1 个内容块。' }],
          toolIsError: false,
        },
        failed: {
          id: 'failed',
          toolName: 'mcp__anvil__create_docx',
          toolInput: { output_path: './failed-report.docx' },
          toolOutput: [{ type: 'text', text: '生成文档失败：文件已存在' }],
          toolIsError: true,
        },
      },
    )

    expect(artifacts).toEqual([
      { itemId: 'pending', status: 'pending', name: 'pending-report.docx' },
      { itemId: 'success', status: 'success', name: 'output-name.docx', path: '/ws/output-name.docx' },
      { itemId: 'failed', status: 'failed', name: 'failed-report.docx', error: '生成文档失败：文件已存在' },
    ])
  })

  test('keeps clickable success path output-derived and ignores assistant prose', () => {
    const artifacts = getGeneratedDocxArtifactsForTurn(
      { itemIds: ['assistant', 'tool'] },
      {
        assistant: {
          id: 'assistant',
          toolName: undefined,
          toolInput: undefined,
          toolOutput: '见 /ws/fake.docx',
          toolIsError: false,
        },
        tool: {
          id: 'tool',
          toolName: 'mcp__anvil__create_docx',
          toolInput: { path: './input.docx' },
          toolOutput: [{ type: 'text', text: '已生成 Word 文档：/ws/real.docx\n包含 1 个内容块。' }],
          toolIsError: false,
        },
      },
    )

    expect(artifacts).toEqual([
      { itemId: 'tool', status: 'success', name: 'real.docx', path: '/ws/real.docx' },
    ])
  })

  test('deduplicates repeated success paths but keeps pending rows by item', () => {
    const artifacts = getGeneratedDocxArtifactsForTurn(
      { itemIds: ['pending-a', 'pending-b', 'success-a', 'success-b'] },
      {
        'pending-a': {
          id: 'pending-a',
          toolName: 'mcp__anvil__create_docx',
          toolInput: { path: './a.docx' },
          toolOutput: undefined,
          toolIsError: false,
        },
        'pending-b': {
          id: 'pending-b',
          toolName: 'mcp__anvil__create_docx',
          toolInput: { path: './b.docx' },
          toolOutput: undefined,
          toolIsError: false,
        },
        'success-a': {
          id: 'success-a',
          toolName: 'mcp__anvil__create_docx',
          toolInput: { path: './one.docx' },
          toolOutput: [{ type: 'text', text: '已生成 Word 文档：/ws/same.docx' }],
          toolIsError: false,
        },
        'success-b': {
          id: 'success-b',
          toolName: 'mcp__anvil__create_docx_from_skill',
          toolInput: { path: './two.docx' },
          toolOutput: [{ type: 'text', text: '已生成 Word 文档：/ws/same.docx' }],
          toolIsError: false,
        },
      },
    )

    expect(artifacts).toEqual([
      { itemId: 'pending-a', status: 'pending', name: 'a.docx' },
      { itemId: 'pending-b', status: 'pending', name: 'b.docx' },
      { itemId: 'success-a', status: 'success', name: 'same.docx', path: '/ws/same.docx' },
    ])
  })
})
