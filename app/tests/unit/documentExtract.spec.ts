import { test, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { extractDocumentText } from '../../electron/main/query/documentReader'

let tmpDir = ''

test.beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anvil-doc-'))
})

test.afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true })
})

test('extracts text from a real .xlsx', async () => {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Data')
  ws.addRow(['Name', 'Age'])
  ws.addRow(['Alice', 30])
  const file = path.join(tmpDir, 'sample.xlsx')
  await wb.xlsx.writeFile(file)

  const text = await extractDocumentText(file)
  expect(text).toContain('Data')
  expect(text).toContain('Name')
  expect(text).toContain('Alice')
})

test('extracts text from a real .docx', async () => {
  const JSZip = (await import('jszip')).default
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>Hello Anvil DOCX fixture</w:t></w:r></w:p></w:body>
</w:document>`

  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypes)
  zip.file('_rels/.rels', rels)
  zip.file('word/document.xml', document)
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  const file = path.join(tmpDir, 'sample.docx')
  await fs.writeFile(file, buffer)

  const text = await extractDocumentText(file)
  expect(text).toContain('Hello Anvil DOCX fixture')
})

test('rejects an unsupported extension', async () => {
  const file = path.join(tmpDir, 'note.txt')
  await fs.writeFile(file, 'plain text')
  await expect(extractDocumentText(file)).rejects.toThrow(/不支持的文档类型/)
})
