import { test, expect } from '@playwright/test'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import {
  extractGeneratedBodyXml,
  generateDocxFromTemplate,
  replaceTemplatePlaceholder,
} from '../../electron/main/query/documentTemplate'

test.describe('document template generation', () => {
  let tmpDir = ''

  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anvil-template-'))
  })

  test.afterAll(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test('replaces a split placeholder paragraph', () => {
    const xml = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      '<w:body>',
      '<w:p><w:r><w:t>{{ANVIL_</w:t></w:r><w:r><w:t>CONTENT}}</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>after</w:t></w:r></w:p>',
      '</w:body>',
      '</w:document>',
    ].join('')

    const replaced = replaceTemplatePlaceholder(xml, '<w:p><w:r><w:t>content</w:t></w:r></w:p>')
    expect(replaced).toContain('<w:t>content</w:t>')
    expect(replaced).not.toContain('{{ANVIL_')
    expect(replaced).toContain('<w:t>after</w:t>')
  })

  test('throws when template has no content placeholder', () => {
    expect(() =>
      replaceTemplatePlaceholder(
        '<w:document><w:body><w:p><w:r><w:t>missing</w:t></w:r></w:p></w:body></w:document>',
        '<w:p/>',
      ),
    ).toThrow('{{ANVIL_CONTENT}}')
  })

  test('extracts generated body without section properties', () => {
    const body = extractGeneratedBodyXml(
      '<w:document><w:body><w:p><w:r><w:t>x</w:t></w:r></w:p><w:sectPr><w:pgSz/></w:sectPr></w:body></w:document>',
    )
    expect(body).toContain('<w:t>x</w:t>')
    expect(body).not.toContain('<w:sectPr')
  })

  test('preserves template package parts and inserts generated content', async () => {
    const template = path.join(tmpDir, 'template.docx')
    const out = path.join(tmpDir, 'out.docx')
    await writeTemplateDocx(template)

    const count = await generateDocxFromTemplate(
      out,
      [
        '# 模板报告',
        '',
        '正文段落。',
        '',
        '1. 第一项',
        '2. 第二项',
        '',
        '| 指标 | 结果 |',
        '|---|---|',
        '| 通过率 | 98% |',
      ].join('\n'),
      '正式标题',
      template,
    )

    expect(count).toBeGreaterThan(0)
    const zip = await JSZip.loadAsync(await fs.readFile(out))
    const documentXml = await readZipText(zip, 'word/document.xml')
    const stylesXml = await readZipText(zip, 'word/styles.xml')
    const relsXml = await readZipText(zip, 'word/_rels/document.xml.rels')
    const contentTypesXml = await readZipText(zip, '[Content_Types].xml')

    expect(stylesXml).toContain('TemplateStyleMarker')
    expect(await readZipText(zip, 'word/header1.xml')).toContain('Template Header')
    expect(await readZipText(zip, 'word/footer1.xml')).toContain('Template Footer')
    expect(documentXml).toContain('正式标题')
    expect(documentXml).toContain('模板报告')
    expect(documentXml).toContain('<w:tbl>')
    expect(documentXml).not.toContain('{{ANVIL_CONTENT}}')
    expect(countOccurrences(documentXml, '<w:sectPr')).toBe(1)
    expect(zip.file('word/numbering.xml')).toBeTruthy()
    expect(relsXml).toContain('relationships/numbering')
    expect(contentTypesXml).toContain('/word/numbering.xml')
  })

  test('refuses to overwrite an existing output without overwrite=true', async () => {
    const template = path.join(tmpDir, 'template-overwrite.docx')
    const out = path.join(tmpDir, 'overwrite.docx')
    await writeTemplateDocx(template)
    await generateDocxFromTemplate(out, 'first', undefined, template)
    await expect(generateDocxFromTemplate(out, 'second', undefined, template)).rejects.toThrow()
    await generateDocxFromTemplate(out, 'third', undefined, template, { overwrite: true })
    const zip = await JSZip.loadAsync(await fs.readFile(out))
    expect(await readZipText(zip, 'word/document.xml')).toContain('third')
  })
})

async function writeTemplateDocx(file: string): Promise<void> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>',
    '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>',
    '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>',
    '</Types>',
  ].join(''))
  zip.file('_rels/.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
    '</Relationships>',
  ].join(''))
  zip.file('word/_rels/document.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>',
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>',
    '</Relationships>',
  ].join(''))
  zip.file('word/styles.xml', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '<w:style w:type="paragraph" w:styleId="TemplateStyleMarker"><w:name w:val="TemplateStyleMarker"/></w:style>',
    '</w:styles>',
  ].join(''))
  zip.file('word/header1.xml', xmlDocumentPart('hdr', 'Template Header'))
  zip.file('word/footer1.xml', xmlDocumentPart('ftr', 'Template Footer'))
  zip.file('word/document.xml', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<w:body>',
    '<w:p><w:r><w:t>{{ANVIL_</w:t></w:r><w:r><w:t>CONTENT}}</w:t></w:r></w:p>',
    '<w:sectPr>',
    '<w:headerReference w:type="default" r:id="rId2"/>',
    '<w:footerReference w:type="default" r:id="rId3"/>',
    '<w:pgSz w:w="11906" w:h="16838"/>',
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>',
    '</w:sectPr>',
    '</w:body>',
    '</w:document>',
  ].join(''))

  await fs.writeFile(file, await zip.generateAsync({ type: 'nodebuffer' }))
}

function xmlDocumentPart(tag: 'hdr' | 'ftr', text: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<w:${tag} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`,
    `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`,
    `</w:${tag}>`,
  ].join('')
}

async function readZipText(zip: JSZip, file: string): Promise<string> {
  const entry = zip.file(file)
  if (!entry) throw new Error(`${file} not found`)
  return entry.async('string')
}

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1
}
