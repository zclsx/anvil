import { test, expect } from '@playwright/test'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  parseInline,
  parseMarkdownBlocks,
  resolveWritePath,
  generateDocx,
  isWriteTargetWithinWorkspace,
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

  test('refuses to overwrite without flag, allows with overwrite', async () => {
    const file = path.join(tmpDir, 'dup.docx')
    await generateDocx(file, 'first version')
    await expect(generateDocx(file, 'second version')).rejects.toThrow()
    await generateDocx(file, 'third version', undefined, { overwrite: true })
    const text = await extractDocumentText(file)
    expect(text).toContain('third version')
  })
})

test.describe('isWriteTargetWithinWorkspace (symlink escape)', () => {
  let wsDir = ''
  let outsideDir = ''

  test.beforeAll(async () => {
    wsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anvil-ws-'))
    outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anvil-out-'))
    await fs.symlink(outsideDir, path.join(wsDir, 'link'))
  })
  test.afterAll(async () => {
    if (wsDir) await fs.rm(wsDir, { recursive: true, force: true })
    if (outsideDir) await fs.rm(outsideDir, { recursive: true, force: true })
  })

  test('allows a normal path inside the workspace', async () => {
    expect(await isWriteTargetWithinWorkspace(path.join(wsDir, 'sub', 'a.docx'), wsDir)).toBe(true)
  })

  test('rejects writing through a symlinked ancestor (non-existent parent)', async () => {
    const target = path.join(wsDir, 'link', 'nested', 'out.docx')
    expect(await isWriteTargetWithinWorkspace(target, wsDir)).toBe(false)
    // and nothing leaked outside
    await expect(fs.access(path.join(outsideDir, 'nested', 'out.docx'))).rejects.toThrow()
  })

  test('rejects when the target itself is a symlink', async () => {
    const linkFile = path.join(wsDir, 'evil.docx')
    await fs.symlink(path.join(outsideDir, 'evil.docx'), linkFile)
    expect(await isWriteTargetWithinWorkspace(linkFile, wsDir)).toBe(false)
  })
})
