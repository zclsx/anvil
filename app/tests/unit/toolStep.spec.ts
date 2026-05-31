import { test, expect } from '@playwright/test'
import { cleanToolName, toolStepSummary, fullToolOutputText } from '../../src/lib/toolStep'

test.describe('cleanToolName', () => {
  test('strips the mcp server prefix', () => {
    expect(cleanToolName('mcp__anvil__create_docx')).toBe('create_docx')
  })
  test('leaves plain tool names', () => {
    expect(cleanToolName('Bash')).toBe('Bash')
  })
  test('falls back for missing name', () => {
    expect(cleanToolName(undefined)).toBe('tool')
  })
})

test.describe('toolStepSummary', () => {
  test('summarizes a completed tool with path arg and multi-line output', () => {
    const s = toolStepSummary({
      toolName: 'mcp__anvil__create_docx',
      toolInput: { path: './out.docx', title: 'x' },
      toolOutput: [{ type: 'text', text: '已生成 Word 文档：/ws/out.docx\n包含 3 个内容块。\n额外行' }],
      toolIsError: false,
      approvalDecision: 'allow',
      approvalRisk: 'high',
    })
    expect(s.label).toBe('create_docx')
    expect(s.argPreview).toBe('./out.docx')
    expect(s.resultPreview).toBe('已生成 Word 文档：/ws/out.docx')
    expect(s.extraLines).toBe(2)
    expect(s.hasOutput).toBe(true)
    expect(s.isError).toBe(false)
    expect(s.approvalLabel).toBe('✓ allowed')
    expect(s.risk).toBe('high')
  })

  test('marks a running tool (no output yet)', () => {
    const s = toolStepSummary({ toolName: 'Bash', toolInput: { command: 'ls' }, toolOutput: undefined })
    expect(s.hasOutput).toBe(false)
    expect(s.resultPreview).toBe('')
    expect(s.extraLines).toBe(0)
    expect(s.approvalLabel).toBeNull()
  })

  test('marks awaiting approval and denied', () => {
    expect(toolStepSummary({ toolName: 'x', approvalId: 'a1' }).approvalLabel).toBe('⏳ awaiting')
    expect(toolStepSummary({ toolName: 'x', approvalId: 'a1', approvalDecision: 'deny' }).approvalLabel).toBe('✕ denied')
  })

  test('marks an errored tool', () => {
    const s = toolStepSummary({
      toolName: 'x',
      toolOutput: [{ type: 'text', text: '生成失败' }],
      toolIsError: true,
    })
    expect(s.isError).toBe(true)
    expect(s.resultPreview).toBe('生成失败')
  })

  test('compacts non-path object input', () => {
    const s = toolStepSummary({ toolName: 'x', toolInput: { a: 1, b: 2 } })
    expect(s.argPreview).toBe('{"a":1,"b":2}')
  })
})

test.describe('fullToolOutputText', () => {
  test('joins array text parts', () => {
    expect(fullToolOutputText([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }])).toBe('a\nb')
  })
  test('reads content-wrapped output', () => {
    expect(fullToolOutputText({ content: [{ type: 'text', text: 'hi' }] })).toBe('hi')
  })
})
