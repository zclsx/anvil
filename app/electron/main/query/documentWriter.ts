import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { DocxAlignment, DocxStyleOptions } from './documentSkill'

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
  | { type: 'table'; headers: InlineRun[][]; rows: InlineRun[][][] }

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

function splitTableRow(line: string): string[] {
  const trimmed = line.trim()
  const withoutOuterPipes = trimmed.replace(/^\|/, '').replace(/\|$/, '')
  return withoutOuterPipes.split('|').map((cell) => cell.trim())
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
}

function isPipeRow(line: string): boolean {
  return line.includes('|') && splitTableRow(line).length > 1
}

function normalizeTableCells(cells: string[], width: number): string[] {
  if (cells.length === width) return cells
  if (cells.length > width) return cells.slice(0, width)
  return [...cells, ...Array.from({ length: width - cells.length }, () => '')]
}

function normalizeTableRunCells(cells: InlineRun[][], width: number): InlineRun[][] {
  if (cells.length === width) return cells
  if (cells.length > width) return cells.slice(0, width)
  return [...cells, ...Array.from({ length: width - cells.length }, () => [{ text: '' }])]
}

/**
 * Parse markdown into a flat list of block descriptors. Block-level support is
 * intentionally small: H1–H3, bullet/numbered list items, paragraphs, and GFM
 * pipe tables. Unsupported blocks still degrade to paragraphs.
 */
export function parseMarkdownBlocks(markdown: string): DocBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: DocBlock[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    const line = raw.trimEnd()
    if (line.trim() === '') continue
    const nextLine = lines[i + 1]?.trimEnd() ?? ''
    if (isPipeRow(line) && isPipeRow(nextLine) && isTableSeparator(nextLine)) {
      const headerCells = splitTableRow(line)
      const width = headerCells.length
      const rows: InlineRun[][][] = []
      i += 2
      while (i < lines.length) {
        const rowLine = lines[i].trimEnd()
        if (rowLine.trim() === '' || !isPipeRow(rowLine)) break
        rows.push(normalizeTableCells(splitTableRow(rowLine), width).map(parseInline))
        i += 1
      }
      i -= 1
      blocks.push({
        type: 'table',
        headers: headerCells.map(parseInline),
        rows,
      })
      continue
    }
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
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    LineRuleType,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import('docx')

  const blocks = parseMarkdownBlocks(markdown)
  const style = options?.style

  const ptToTwip = (pt?: number) => (typeof pt === 'number' ? Math.round(pt * 20) : undefined)
  const ptToHalf = (pt?: number) => (typeof pt === 'number' ? Math.round(pt * 2) : undefined)
  const lineSpacingToTwip = (multiplier?: number) =>
    typeof multiplier === 'number' ? Math.round(multiplier * 240) : undefined
  const toAlignment = (alignment?: DocxAlignment) => {
    if (alignment === 'left') return AlignmentType.LEFT
    if (alignment === 'center') return AlignmentType.CENTER
    if (alignment === 'right') return AlignmentType.RIGHT
    if (alignment === 'justify') return AlignmentType.JUSTIFIED
    return undefined
  }
  const compactRecord = (values: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))
  const paragraphSpacing = (before?: number, after?: number) => {
    const line = lineSpacingToTwip(style?.lineSpacing)
    const spacing = compactRecord({
      before: ptToTwip(before),
      after: ptToTwip(after),
      line,
      lineRule: line !== undefined ? LineRuleType.AUTO : undefined,
    })
    return Object.keys(spacing).length > 0 ? spacing : undefined
  }
  const bodyParagraphOptions = (withFirstLineIndent: boolean) => {
    if (!style) return {}
    return compactRecord({
      spacing: paragraphSpacing(style.paragraphSpacingBefore, style.paragraphSpacingAfter),
      indent: withFirstLineIndent ? compactRecord({ firstLine: ptToTwip(style.firstLineIndent) }) : undefined,
      alignment: toAlignment(style.alignment),
    })
  }
  const headingParagraphStyle = (
    sizePt?: number,
    spacingBefore?: number,
    spacingAfter?: number,
  ) => {
    const run = compactRecord({ size: ptToHalf(sizePt), bold: true })
    const paragraph = compactRecord({ spacing: paragraphSpacing(spacingBefore, spacingAfter) })
    return compactRecord({
      run: Object.keys(run).length > 0 ? run : undefined,
      paragraph: Object.keys(paragraph).length > 0 ? paragraph : undefined,
    })
  }

  const toTextRuns = (runs: InlineRun[]) =>
    runs.map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic }))

  const toParagraph = (block: Exclude<DocBlock, { type: 'table' }>) => {
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
      return new Paragraph({ bullet: { level: 0 }, children, ...bodyParagraphOptions(false) })
    }
    if (block.type === 'numbered') {
      return new Paragraph({
        numbering: { reference: NUMBERING_REFERENCE, level: 0 },
        children,
        ...bodyParagraphOptions(false),
      })
    }
    return new Paragraph({ children, ...bodyParagraphOptions(true) })
  }

  const tablePadding = ptToTwip(style?.tableCellPadding)
  const tableBorder = {
    style: BorderStyle.SINGLE,
    size: style?.tableBorderSize ?? 1,
    color: style?.tableBorderColor ?? 'B8C2D6',
  }
  const tableCellMargins =
    tablePadding !== undefined
      ? {
          marginUnitType: WidthType.DXA,
          top: tablePadding,
          bottom: tablePadding,
          left: tablePadding,
          right: tablePadding,
        }
      : {
          marginUnitType: WidthType.DXA,
          top: 80,
          bottom: 80,
          left: 120,
          right: 120,
        }
  const tableHeaderShading = style?.tableHeaderShading ?? 'EEF4FF'
  const tableHeaderBold = style?.tableHeaderBold ?? true
  const tableWidth = style?.tableWidth ?? 100
  const toTable = (block: Extract<DocBlock, { type: 'table' }>) => {
    const width = Math.max(1, block.headers.length)
    const cellWidth = Math.floor(9000 / width)
    const toCell = (runs: InlineRun[], header: boolean) =>
      new TableCell({
        width: { size: cellWidth, type: WidthType.DXA },
        margins: tableCellMargins,
        shading: header ? { fill: tableHeaderShading } : undefined,
        children: [
          new Paragraph({
            children: toTextRuns(
              header && tableHeaderBold ? runs.map((run) => ({ ...run, bold: true })) : runs,
            ),
          }),
        ],
      })
    return new Table({
      width: { size: tableWidth, type: WidthType.PERCENTAGE },
      borders: {
        top: tableBorder,
        bottom: tableBorder,
        left: tableBorder,
        right: tableBorder,
        insideHorizontal: tableBorder,
        insideVertical: tableBorder,
      },
      rows: [
        new TableRow({
          tableHeader: true,
          children: block.headers.map((cell) => toCell(cell, true)),
        }),
        ...block.rows.map((row) =>
          new TableRow({
            children: normalizeTableRunCells(row, width).map((cell) => toCell(cell, false)),
          }),
        ),
      ],
    })
  }

  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = []
  if (title) {
    const titleRun = compactRecord({
      text: title,
      bold: style ? style.titleBold : true,
      size: style ? ptToHalf(style.titleSize) : undefined,
    })
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun(titleRun)],
        ...(style
          ? compactRecord({
              alignment: toAlignment(style.titleAlignment),
              spacing: compactRecord({ after: ptToTwip(style.titleSpacingAfter) }),
            })
          : {}),
      }),
    )
  }
  for (const block of blocks) {
    children.push(block.type === 'table' ? toTable(block) : toParagraph(block))
  }

  const section = style
    ? {
        properties: {
          page: {
            margin: {
              top: ptToTwip(style.pageMarginTop),
              right: ptToTwip(style.pageMarginRight),
              bottom: ptToTwip(style.pageMarginBottom),
              left: ptToTwip(style.pageMarginLeft),
            },
          },
        },
        children,
      }
    : { children }

  const docOptions: Record<string, unknown> = {
    numbering: {
      config: [
        {
          reference: NUMBERING_REFERENCE,
          levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }],
        },
      ],
    },
    sections: [section],
  }

  if (style) {
    docOptions.styles = {
      default: {
        document: {
          run: { font: style.font, size: ptToHalf(style.bodySize) },
        },
        heading1: headingParagraphStyle(style.heading1Size, style.heading1SpacingBefore, style.heading1SpacingAfter),
        heading2: headingParagraphStyle(style.heading2Size, style.heading2SpacingBefore, style.heading2SpacingAfter),
        heading3: headingParagraphStyle(style.heading3Size, style.heading3SpacingBefore, style.heading3SpacingAfter),
      },
    }
  }

  const doc = new Document(docOptions as ConstructorParameters<typeof Document>[0])

  const buffer = await Packer.toBuffer(doc)
  await fs.mkdir(path.dirname(absPath), { recursive: true })
  await fs.writeFile(absPath, buffer, { flag: options?.overwrite ? 'w' : 'wx' })
  return blocks.length
}
