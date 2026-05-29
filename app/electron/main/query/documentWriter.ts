import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { DocxStyleOptions } from './documentSkill'

export interface InlineRun {
  text: string
  bold?: boolean
  italic?: boolean
}

export type DocBlock =
  | { type: 'heading'; level: 1 | 2 | 3; runs: InlineRun[] }
  | { type: 'paragraph'; runs: InlineRun[] }
  | { type: 'bullet'; runs: InlineRun[] }
  | { type: 'numbered'; runs: InlineRun[] }

export type ResolvedWritePath =
  | { ok: true; absPath: string }
  | { ok: false; error: string }

/**
 * Parse a single line's inline markdown into styled runs.
 * Supports **bold** and *italic*; nesting is not handled (first-level only),
 * which is enough for agent-generated reports.
 */
export function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = []
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) })
    if (m[1] !== undefined) runs.push({ text: m[1], bold: true })
    else if (m[2] !== undefined) runs.push({ text: m[2], italic: true })
    last = re.lastIndex
  }
  if (last < text.length) runs.push({ text: text.slice(last) })
  if (runs.length === 0) runs.push({ text })
  return runs
}

/**
 * Parse markdown into a flat list of block descriptors. Block-level only:
 * H1–H3, bullet/numbered list items, and paragraphs. Tables/images/code
 * fences degrade to plain paragraphs. Each non-empty line is one block.
 */
export function parseMarkdownBlocks(markdown: string): DocBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: DocBlock[] = []
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.trim() === '') continue
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        runs: parseInline(heading[2]),
      })
      continue
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      blocks.push({ type: 'bullet', runs: parseInline(bullet[1]) })
      continue
    }
    const numbered = /^\d+\.\s+(.*)$/.exec(line)
    if (numbered) {
      blocks.push({ type: 'numbered', runs: parseInline(numbered[1]) })
      continue
    }
    blocks.push({ type: 'paragraph', runs: parseInline(line) })
  }
  return blocks
}

/**
 * Resolve and validate an output path for a generated document. Writes are
 * stricter than reads: workspace-only (no external allowlist) and the
 * extension must be .docx so the tool can't be steered into writing an
 * executable or config file.
 */
export function resolveWritePath(rawPath: string, workspacePath: string): ResolvedWritePath {
  const cleaned = rawPath.trim().replace(/^`+/, '').replace(/`+$/, '').trim()
  if (!cleaned) return { ok: false, error: '未提供输出路径' }
  if (!workspacePath) return { ok: false, error: '当前没有可用的 workspace' }

  const workspaceAbs = path.resolve(workspacePath)
  const absPath = path.isAbsolute(cleaned)
    ? path.resolve(cleaned)
    : path.resolve(workspaceAbs, cleaned)

  const rel = path.relative(workspaceAbs, absPath)
  const insideWorkspace = rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
  if (!insideWorkspace) {
    return { ok: false, error: `只能写入 workspace 内：${cleaned}` }
  }
  if (path.extname(absPath).toLowerCase() !== '.docx') {
    return { ok: false, error: '输出文件必须是 .docx' }
  }
  return { ok: true, absPath }
}

const NUMBERING_REFERENCE = 'anvil-numbered'

/**
 * Confirm a write target stays inside the workspace even when intermediate
 * directories don't exist yet. A lexical check is not enough: `mkdir -p`
 * follows an existing symlinked ancestor and would write outside. So we
 * resolve the *nearest existing ancestor* (the dir mkdir will actually start
 * from) and require its real path to be within the workspace, and reject when
 * the target file itself already exists as a symlink.
 */
export async function isWriteTargetWithinWorkspace(
  absPath: string,
  workspacePath: string,
): Promise<boolean> {
  try {
    const realWorkspace = await fs.realpath(workspacePath)

    let probe = path.dirname(absPath)
    let realAncestor: string | null = null
    for (;;) {
      try {
        realAncestor = await fs.realpath(probe)
        break
      } catch {
        const parent = path.dirname(probe)
        if (parent === probe) break
        probe = parent
      }
    }
    if (!realAncestor) return false

    const rel = path.relative(realWorkspace, realAncestor)
    const ancestorInside = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
    if (!ancestorInside) return false

    try {
      const stat = await fs.lstat(absPath)
      if (stat.isSymbolicLink()) return false
    } catch {
      // target doesn't exist yet — fine
    }

    return true
  } catch {
    return false
  }
}

/**
 * Generate a .docx from markdown and write it. The `docx` library is loaded
 * lazily so the pure parsing/path functions stay test-friendly. Returns the
 * number of content blocks written. Without `overwrite`, the write is atomic
 * (`wx`) and throws `EEXIST` rather than clobbering an existing file.
 */
export async function generateDocx(
  absPath: string,
  markdown: string,
  title?: string,
  options?: { overwrite?: boolean; style?: DocxStyleOptions },
): Promise<number> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx')

  const blocks = parseMarkdownBlocks(markdown)

  const toTextRuns = (runs: InlineRun[]) =>
    runs.map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic }))

  const toParagraph = (block: DocBlock) => {
    const children = toTextRuns(block.runs)
    if (block.type === 'heading') {
      const level =
        block.level === 1
          ? HeadingLevel.HEADING_1
          : block.level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3
      return new Paragraph({ heading: level, children })
    }
    if (block.type === 'bullet') {
      return new Paragraph({ bullet: { level: 0 }, children })
    }
    if (block.type === 'numbered') {
      return new Paragraph({ numbering: { reference: NUMBERING_REFERENCE, level: 0 }, children })
    }
    return new Paragraph({ children })
  }

  const children: InstanceType<typeof Paragraph>[] = []
  if (title) {
    children.push(
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title, bold: true })] }),
    )
  }
  for (const block of blocks) children.push(toParagraph(block))

  const docOptions: Record<string, unknown> = {
    numbering: {
      config: [
        {
          reference: NUMBERING_REFERENCE,
          levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }],
        },
      ],
    },
    sections: [{ children }],
  }

  const style = options?.style
  if (style) {
    const ptToHalf = (pt?: number) => (typeof pt === 'number' ? Math.round(pt * 2) : undefined)
    const headingStyle = (pt?: number) => {
      const size = ptToHalf(pt)
      return size ? { run: { size, bold: true } } : undefined
    }
    docOptions.styles = {
      default: {
        document: {
          run: { font: style.font, size: ptToHalf(style.bodySize) },
          paragraph:
            style.paragraphSpacingAfter != null
              ? { spacing: { after: style.paragraphSpacingAfter } }
              : undefined,
        },
        heading1: headingStyle(style.heading1Size),
        heading2: headingStyle(style.heading2Size),
        heading3: headingStyle(style.heading3Size),
      },
    }
  }

  const doc = new Document(docOptions as ConstructorParameters<typeof Document>[0])

  const buffer = await Packer.toBuffer(doc)
  await fs.mkdir(path.dirname(absPath), { recursive: true })
  await fs.writeFile(absPath, buffer, { flag: options?.overwrite ? 'w' : 'wx' })
  return blocks.length
}
