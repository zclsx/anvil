import { test, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import {
  parseInline,
  parseMarkdownBlocks,
  resolveWritePath,
  generateDocx,
  isWriteTargetWithinWorkspace,
} from '../../electron/main/query/documentWriter'
import { extractDocumentText } from '../../electron/main/query/documentReader'
import { DEFAULT_DOCX_STYLE } from '../../electron/main/query/documentSkill'

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

  test('parses inline code without keeping backticks', () => {
    expect(parseInline('运行 `npm test` 后继续')).toEqual([
      { text: '运行 ' },
      { text: 'npm test', code: true },
      { text: ' 后继续' },
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

  test('parses a markdown pipe table into a table block', () => {
    const blocks = parseMarkdownBlocks([
      '# Report',
      '',
      '| 组别 | **场景** | 结果 |',
      '|---|:---:|---|',
      '| A | *登录* | 通过 |',
      '| B | 导出 | 失败 |',
    ].join('\n'))

    expect(blocks.map((b) => b.type)).toEqual(['heading', 'table'])
    expect(blocks[1]).toMatchObject({
      type: 'table',
      headers: [[{ text: '组别' }], [{ text: '场景', bold: true }], [{ text: '结果' }]],
      rows: [
        [[{ text: 'A' }], [{ text: '登录', italic: true }], [{ text: '通过' }]],
        [[{ text: 'B' }], [{ text: '导出' }], [{ text: '失败' }]],
      ],
    })
  })

  test('does not emit table separator rows as paragraphs', () => {
    const blocks = parseMarkdownBlocks('| A | B |\n|---|---|\n| 1 | 2 |')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('table')
    expect(JSON.stringify(blocks)).not.toContain('---')
  })

  test('does not treat a bare thematic break after pipe text as a table', () => {
    const blocks = parseMarkdownBlocks('汇总 | 详情\n---\n正文')
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'paragraph', 'paragraph'])
  })

  test('parses fenced code blocks and callouts', () => {
    const blocks = parseMarkdownBlocks([
      '正文',
      '',
      '```ts',
      'const ok = true',
      'console.log(ok)',
      '```',
      '',
      '> [!note] 关键结论',
      '> 需要保留证据链。',
    ].join('\n'))

    expect(blocks).toMatchObject([
      { type: 'paragraph' },
      { type: 'codeblock', lines: ['const ok = true', 'console.log(ok)'] },
      {
        type: 'callout',
        label: 'NOTE',
        lines: [[{ text: '关键结论' }], [{ text: '需要保留证据链。' }]],
      },
    ])
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

  test('generates real Word tables from markdown pipe tables', async () => {
    const file = path.join(tmpDir, 'tables.docx')
    await generateDocx(
      file,
      [
        '# 视觉偏差测试',
        '',
        '| 组别 | 测试场景 | 夹具载荷 |',
        '|------|----------|----------|',
        '| A | **基准** | 10kg |',
        '| B | *偏差* | 12kg |',
        '',
        '| 指标 | 结果 |',
        '|---|---|',
        '| 通过率 | 98% |',
      ].join('\n'),
    )

    const xml = await readDocumentXml(file)
    expect(countOccurrences(xml, '<w:tbl>')).toBe(2)
    expect(xml).not.toContain('|------|')
    expect(xml).not.toContain('|---|')

    const text = await extractDocumentText(file)
    expect(text).toContain('视觉偏差测试')
    expect(text).toContain('组别')
    expect(text).toContain('测试场景')
    expect(text).toContain('通过率')
  })

  test('applies v2 table style values to exact Word XML attributes', async () => {
    const file = path.join(tmpDir, 'table-style-v2.docx')
    await generateDocx(
      file,
      [
        '| 组别 | 结果 |',
        '|---|---|',
        '| A | 通过 |',
      ].join('\n'),
      undefined,
      { style: DEFAULT_DOCX_STYLE },
    )

    const xml = await readDocumentXml(file)
    expectXmlTagAttributes(xml, 'w:top', { 'w:color': 'B8C2D6' })
    expectXmlTagAttributes(xml, 'w:shd', { 'w:fill': 'EEF4FF' })
    expectXmlTagAttributes(xml, 'w:top', { 'w:w': '120', 'w:type': 'dxa' })
    expectXmlTagAttributes(xml, 'w:left', { 'w:w': '120', 'w:type': 'dxa' })
  })

  test('applies custom table style overrides', async () => {
    const file = path.join(tmpDir, 'table-style-custom.docx')
    await generateDocx(
      file,
      [
        '| 组别 | 结果 |',
        '|---|---|',
        '| A | 通过 |',
      ].join('\n'),
      undefined,
      {
        style: {
          ...DEFAULT_DOCX_STYLE,
          tableBorderColor: 'AA0000',
          tableBorderSize: 3,
          tableCellPadding: 8,
          tableHeaderShading: 'DDEEFF',
          tableHeaderBold: false,
          tableWidth: 80,
        },
      },
    )

    const xml = await readDocumentXml(file)
    expectXmlTagAttributes(xml, 'w:tblW', { 'w:w': '80%', 'w:type': 'pct' })
    expectXmlTagAttributes(xml, 'w:top', { 'w:color': 'AA0000', 'w:sz': '3' })
    expectXmlTagAttributes(xml, 'w:shd', { 'w:fill': 'DDEEFF' })
    expectXmlTagAttributes(xml, 'w:top', { 'w:w': '160', 'w:type': 'dxa' })
    const headerParagraph = findParagraphContaining(xml, '组别')
    expect(headerParagraph).not.toContain('<w:b')
  })

  test('applies v2 document style values to exact Word XML attributes', async () => {
    const file = path.join(tmpDir, 'style-v2.docx')
    await generateDocx(file, '# 第一章\n\n正文段落。', '正式报告', { style: DEFAULT_DOCX_STYLE })

    const xml = await readDocumentXml(file)
    const stylesXml = await readStylesXml(file)
    const footerXml = await readFooterXml(file)
    expectXmlTagAttributes(xml, 'w:pgMar', {
      'w:top': '1440',
      'w:right': '1440',
      'w:bottom': '1440',
      'w:left': '1440',
    })
    expectXmlTagAttributes(stylesXml, 'w:rFonts', {
      'w:ascii': 'Arial',
      'w:hAnsi': 'Arial',
      'w:eastAsia': 'Microsoft YaHei',
    })
    expectXmlTagAttributes(stylesXml, 'w:sz', { 'w:val': '22' })

    const titleParagraph = findParagraphContaining(xml, '正式报告')
    expectXmlTagAttributes(titleParagraph, 'w:jc', { 'w:val': 'center' })
    expectXmlTagAttributes(titleParagraph, 'w:spacing', { 'w:after': '240' })
    expectXmlTagAttributes(titleParagraph, 'w:sz', { 'w:val': '44' })
    expectXmlTagAttributes(titleParagraph, 'w:rFonts', {
      'w:ascii': 'Arial',
      'w:eastAsia': 'Microsoft YaHei',
    })

    const bodyParagraph = findParagraphContaining(xml, '正文段落。')
    expectXmlTagAttributes(bodyParagraph, 'w:spacing', {
      'w:before': '0',
      'w:after': '120',
      'w:line': '276',
      'w:lineRule': 'auto',
    })
    expectXmlTagAttributes(bodyParagraph, 'w:ind', { 'w:firstLine': '440' })
    expectXmlTagAttributes(bodyParagraph, 'w:jc', { 'w:val': 'both' })
    expectXmlTagAttributes(bodyParagraph, 'w:rFonts', {
      'w:ascii': 'Arial',
      'w:eastAsia': 'Microsoft YaHei',
    })

    const headingParagraph = findParagraphContaining(xml, '第一章')
    expect(headingParagraph).not.toMatch(/\bw:firstLine="440"/)
    expect(footerXml).toContain('正式报告')
    expect(footerXml).toContain('PAGE')
  })

  test('renders inline code and fenced code with mono font and shading', async () => {
    const file = path.join(tmpDir, 'code-format.docx')
    await generateDocx(
      file,
      [
        '正文里有 `npm test` 命令。',
        '',
        '```ts',
        'const ok = true',
        'console.log(ok)',
        '```',
      ].join('\n'),
      '代码报告',
      { style: DEFAULT_DOCX_STYLE },
    )

    const xml = await readDocumentXml(file)
    expect(xml).not.toContain('`npm test`')

    const inlineRun = findRunContaining(xml, 'npm test')
    expectXmlTagAttributes(inlineRun, 'w:rFonts', {
      'w:ascii': 'Consolas',
      'w:hAnsi': 'Consolas',
      'w:eastAsia': 'Consolas',
    })
    expectXmlTagAttributes(inlineRun, 'w:shd', { 'w:fill': 'F5F7FA' })

    const codeParagraph = findParagraphContaining(xml, 'const ok = true')
    expectXmlTagAttributes(codeParagraph, 'w:shd', { 'w:fill': 'EEF3F8' })
    expectXmlTagAttributes(codeParagraph, 'w:jc', { 'w:val': 'left' })
    expect(codeParagraph).not.toMatch(/\bw:firstLine="440"/)
    expectXmlTagAttributes(findRunContaining(codeParagraph, 'const ok = true'), 'w:rFonts', {
      'w:ascii': 'Consolas',
      'w:eastAsia': 'Consolas',
    })
  })

  test('renders callout blocks as shaded bordered paragraphs', async () => {
    const file = path.join(tmpDir, 'callout.docx')
    await generateDocx(
      file,
      '> [!warning] 关键风险\n> 请先复核数据来源。',
      '风险提示',
      { style: DEFAULT_DOCX_STYLE },
    )

    const xml = await readDocumentXml(file)
    const paragraph = findParagraphContaining(xml, '关键风险')
    expectXmlTagAttributes(paragraph, 'w:shd', { 'w:fill': 'F5F7FA' })
    expectXmlTagAttributes(paragraph, 'w:left', { 'w:color': '9AB2D0' })
    expect(paragraph).toContain('WARNING')
  })

  test('keeps unstyled create_docx output free of skill-only layout markers', async () => {
    const file = path.join(tmpDir, 'unstyled.docx')
    await generateDocx(file, '# 标题\n\n正文段落。', '普通文档')

    const xml = await readDocumentXml(file)
    const stylesXml = await readStylesXml(file)
    expect(xml).not.toMatch(/\bw:firstLine="440"/)
    expect(xml).not.toMatch(/\bw:line="276"/)
    expect(stylesXml).not.toContain('Microsoft YaHei')
    await expect(readFooterXml(file)).rejects.toThrow()
  })
})

async function readDocumentXml(file: string): Promise<string> {
  const zip = await JSZip.loadAsync(await fs.readFile(file))
  const documentXml = zip.file('word/document.xml')
  if (!documentXml) throw new Error('word/document.xml not found')
  return documentXml.async('string')
}

async function readStylesXml(file: string): Promise<string> {
  const zip = await JSZip.loadAsync(await fs.readFile(file))
  const stylesXml = zip.file('word/styles.xml')
  if (!stylesXml) throw new Error('word/styles.xml not found')
  return stylesXml.async('string')
}

async function readFooterXml(file: string): Promise<string> {
  const zip = await JSZip.loadAsync(await fs.readFile(file))
  const footerPath = Object.keys(zip.files).find((name) => /^word\/footer\d+\.xml$/.test(name))
  if (!footerPath) throw new Error('footer xml not found')
  const footerXml = zip.file(footerPath)
  if (!footerXml) throw new Error('footer xml not found')
  return footerXml.async('string')
}

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1
}

function expectXmlTagAttributes(xml: string, tagName: string, attrs: Record<string, string>): void {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const tags = xml.match(new RegExp(`<${escapedTag}\\b[^>]*>`, 'g')) ?? []
  const found = tags.some((tag) =>
    Object.entries(attrs).every(([name, value]) => tag.includes(`${name}="${value}"`)),
  )
  if (!found) throw new Error(`${tagName} with ${JSON.stringify(attrs)} not found in ${tags.join('\n')}`)
}

function findParagraphContaining(xml: string, text: string): string {
  const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []
  const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const paragraph = paragraphs.find((p) => new RegExp(`<w:t\\b[^>]*>${escapedText}</w:t>`).test(p))
  if (!paragraph) throw new Error(`paragraph not found: ${text}`)
  return paragraph
}

function findRunContaining(xml: string, text: string): string {
  const runs = xml.match(/<w:r\b[\s\S]*?<\/w:r>/g) ?? []
  const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const run = runs.find((r) => new RegExp(`<w:t\\b[^>]*>${escapedText}</w:t>`).test(r))
  if (!run) throw new Error(`run not found: ${text}`)
  return run
}

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
