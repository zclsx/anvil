import { test, expect } from '@playwright/test'
import { parseCreatedDocxPath, getGeneratedDocxPath } from '../../src/lib/generatedFiles'

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
