import { promises as fs } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { buildDocxBuffer } from './documentWriter'

const CONTENT_PLACEHOLDER = '{{ANVIL_CONTENT}}'
const NUMBERING_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering'
const NUMBERING_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml'

export function extractGeneratedBodyXml(documentXml: string): string {
  const body = /<w:body\b[^>]*>([\s\S]*?)<\/w:body>/.exec(documentXml)
  if (!body) throw new Error('生成文档缺少 body')
  const inner = body[1]
  const sectIndex = inner.lastIndexOf('<w:sectPr')
  return (sectIndex >= 0 ? inner.slice(0, sectIndex) : inner).trim()
}

export function replaceTemplatePlaceholder(documentXml: string, contentXml: string): string {
  const paragraphs = documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []
  const target = paragraphs.find((paragraph) => getParagraphText(paragraph).includes(CONTENT_PLACEHOLDER))
  if (!target) {
    throw new Error(`模板必须包含占位符 ${CONTENT_PLACEHOLDER}`)
  }
  return documentXml.replace(target, contentXml)
}

export async function generateDocxFromTemplate(
  absPath: string,
  markdown: string,
  title: string | undefined,
  templatePath: string,
  options?: { overwrite?: boolean },
): Promise<number> {
  const generated = await buildDocxBuffer(markdown, title)
  const [templateZip, generatedZip] = await Promise.all([
    JSZip.loadAsync(await fs.readFile(templatePath)),
    JSZip.loadAsync(generated.buffer),
  ])

  const templateDocument = templateZip.file('word/document.xml')
  const generatedDocument = generatedZip.file('word/document.xml')
  if (!templateDocument) throw new Error('模板缺少 word/document.xml')
  if (!generatedDocument) throw new Error('生成文档缺少 word/document.xml')

  const generatedDocumentXml = await generatedDocument.async('string')
  const generatedBodyXml = extractGeneratedBodyXml(generatedDocumentXml)
  const templateDocumentXml = await templateDocument.async('string')
  templateZip.file('word/document.xml', replaceTemplatePlaceholder(templateDocumentXml, generatedBodyXml))

  if (generatedBodyXml.includes('<w:numPr>')) {
    await copyNumberingPart(templateZip, generatedZip)
  }

  const buffer = await templateZip.generateAsync({ type: 'nodebuffer' })
  await fs.mkdir(path.dirname(absPath), { recursive: true })
  await fs.writeFile(absPath, buffer, { flag: options?.overwrite ? 'w' : 'wx' })
  return generated.blockCount
}

function getParagraphText(paragraphXml: string): string {
  return [...paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXmlText(match[1]))
    .join('')
}

function decodeXmlText(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

async function copyNumberingPart(templateZip: JSZip, generatedZip: JSZip): Promise<void> {
  const numbering = generatedZip.file('word/numbering.xml')
  if (!numbering) return
  templateZip.file('word/numbering.xml', await numbering.async('string'))
  await ensureNumberingRelationship(templateZip)
  await ensureNumberingContentType(templateZip)
}

async function ensureNumberingRelationship(templateZip: JSZip): Promise<void> {
  const pathInZip = 'word/_rels/document.xml.rels'
  const existing = templateZip.file(pathInZip)
  const xml = existing
    ? await existing.async('string')
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
  if (xml.includes(NUMBERING_REL_TYPE)) return
  const nextId = getNextRelationshipId(xml)
  const relationship = `<Relationship Id="rId${nextId}" Type="${NUMBERING_REL_TYPE}" Target="numbering.xml"/>`
  templateZip.file(pathInZip, xml.replace('</Relationships>', `${relationship}</Relationships>`))
}

async function ensureNumberingContentType(templateZip: JSZip): Promise<void> {
  const pathInZip = '[Content_Types].xml'
  const file = templateZip.file(pathInZip)
  if (!file) throw new Error('模板缺少 [Content_Types].xml')
  const xml = await file.async('string')
  if (xml.includes('PartName="/word/numbering.xml"')) return
  const override = `<Override PartName="/word/numbering.xml" ContentType="${NUMBERING_CONTENT_TYPE}"/>`
  templateZip.file(pathInZip, xml.replace('</Types>', `${override}</Types>`))
}

function getNextRelationshipId(xml: string): number {
  const ids = [...xml.matchAll(/\bId="rId(\d+)"/g)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite)
  return ids.length === 0 ? 1 : Math.max(...ids) + 1
}
