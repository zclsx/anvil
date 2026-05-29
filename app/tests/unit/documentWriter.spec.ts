import { test, expect } from '@playwright/test'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  parseInline,
  parseMarkdownBlocks,
  resolveWritePath,
  generateDocx,
} from '../../electron/main/query/documentWriter'
import { extractDocumentText } from '../../electron/main/query/documentReader'

test.describe('parseInline', () => {
  test('plain text is a single run', () => {
    expect(parseInline('hello world')).toEqual([{ text: 'hello world' }])
  })

  test('parses bold and italic segments', () => {
    expect(parseInline('a **b** c *d* e')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' c ' },
      { text: 'd', italic: true },
      { text: ' e' },
    ])
  })
})

test.describe('parseMarkdownBlocks', () => {
  test('classifies headings, lists, and paragraphs', () => {
    const blocks = parseMarkdownBlocks('# Title\n\nbody text\n- one\n- two\n1. first')
    expect(blocks.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
      'bullet',
      'bullet',
      'numbered',
    ])
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 })
  })

  test('skips blank lines', () => {
    expect(parseMarkdownBlocks('a\n\n\nb')).toHaveLength(2)
  })
})

test.describe('resolveWritePath', () => {
  const ws = '/Users/test/proj'

  test('resolves a workspace-relative .docx path', () => {
    expect(resolveWritePath('./outputs/report.docx', ws)).toEqual({
      ok: true,
      absPath: '/Users/test/proj/outputs/report.docx',
    })
  })

  test('rejects writing outside the workspace', () => {
    expect(resolveWritePath('../escape.docx', ws).ok).toBe(false)
    expect(resolveWritePath('/tmp/x.docx', ws).ok).toBe(false)
  })

  test('rejects a non-.docx extension', () => {
    expect(resolveWritePath('./report.txt', ws).ok).toBe(false)
    expect(resolveWritePath('./report.sh', ws).ok).toBe(false)
  })
})

test.describe('generateDocx round-trip', () => {
  let tmpDir = ''

  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anvil-write-'))
  })
  test.afterAll(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test('generated .docx reads back with its content', async () => {
    const file = path.join(tmpDir, 'nested', 'out.docx')
    const count = await generateDocx(
      file,
      '# 报告标题\n\n这是正文段落。\n- 第一点\n- 第二点',
      '面试评估报告',
    )
    expect(count).toBeGreaterThan(0)

    const text = await extractDocumentText(file)
    expect(text).toContain('面试评估报告')
    expect(text).toContain('报告标题')
    expect(text).toContain('这是正文段落')
    expect(text).toContain('第一点')
  })
})
