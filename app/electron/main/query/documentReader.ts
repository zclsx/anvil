import path from 'node:path'

export const SUPPORTED_DOCUMENT_EXTENSIONS = ['.docx', '.xlsx'] as const

export interface PaginatedText {
  text: string
  totalChars: number
  returnedChars: number
  offset: number
  nextOffset: number | null
  hasMore: boolean
}

export type ResolvedDocumentPath =
  | { ok: true; absPath: string; source: 'workspace' | 'reference' }
  | { ok: false; error: string }

/**
 * Pure character-window pagination over already-extracted text.
 * Keeps large documents from blowing up the model context: the model can
 * page through with `offset` until `hasMore` is false.
 */
export function paginateText(full: string, offset = 0, maxChars = 12000): PaginatedText {
  const total = full.length
  const safeOffset = Math.max(0, Math.min(Math.trunc(offset), total))
  const safeMax = Math.max(1, Math.trunc(maxChars))
  const slice = full.slice(safeOffset, safeOffset + safeMax)
  const consumedEnd = safeOffset + slice.length
  const hasMore = consumedEnd < total
  return {
    text: slice,
    totalChars: total,
    returnedChars: slice.length,
    offset: safeOffset,
    nextOffset: hasMore ? consumedEnd : null,
    hasMore,
  }
}

/**
 * Resolve a model-supplied document path. The model may pass a
 * workspace-relative path (`./report.docx`), an absolute path, or a value
 * wrapped in markdown backticks — all are normalized here.
 *
 * A path is allowed when it is either:
 *   - inside the session workspace (same reach Bash/Read already have), or
 *   - one of the absolute paths the user explicitly referenced this turn
 *     (dropped via a file-reference chip), even if outside the workspace.
 *
 * Anything else (a path the model invented, e.g. an SSH key) is rejected,
 * which matters because this read-only tool is auto-approved.
 */
export function resolveDocumentPath(
  rawPath: string,
  workspacePath: string,
  allowedExternalPaths: string[] = [],
): ResolvedDocumentPath {
  const cleaned = rawPath.trim().replace(/^`+/, '').replace(/`+$/, '').trim()
  if (!cleaned) return { ok: false, error: '未提供文档路径' }
  if (!workspacePath) return { ok: false, error: '当前没有可用的 workspace' }

  const workspaceAbs = path.resolve(workspacePath)
  const absPath = path.isAbsolute(cleaned)
    ? path.resolve(cleaned)
    : path.resolve(workspaceAbs, cleaned)

  const rel = path.relative(workspaceAbs, absPath)
  const insideWorkspace = rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
  if (insideWorkspace) {
    return { ok: true, absPath, source: 'workspace' }
  }

  const allowed = new Set(allowedExternalPaths.map((p) => path.resolve(p)))
  if (allowed.has(absPath)) {
    return { ok: true, absPath, source: 'reference' }
  }

  return {
    ok: false,
    error: `只能读取 workspace 内或本轮引用过的文件：${cleaned}`,
  }
}

export function isSupportedDocument(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return (SUPPORTED_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)
}

async function readDocx(absPath: string): Promise<string> {
  const mammoth = (await import('mammoth')).default ?? (await import('mammoth'))
  const result = await mammoth.extractRawText({ path: absPath })
  return result.value
}

async function readXlsx(absPath: string): Promise<string> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(absPath)

  const parts: string[] = []
  workbook.eachSheet((sheet) => {
    parts.push(`# Sheet: ${sheet.name}`)
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: false }, (cell) => {
        cells.push(String(cell.text ?? ''))
      })
      parts.push(cells.join('\t'))
    })
    parts.push('')
  })
  return parts.join('\n')
}

/**
 * Extract plain text from a supported Office document. Parsers are loaded
 * lazily so the renderer's pure-function tests (and app startup) never pull
 * in mammoth/exceljs unless a document is actually read.
 */
export async function extractDocumentText(absPath: string): Promise<string> {
  const ext = path.extname(absPath).toLowerCase()
  if (ext === '.docx') return readDocx(absPath)
  if (ext === '.xlsx') return readXlsx(absPath)
  throw new Error(`不支持的文档类型：${ext || '(无扩展名)'}（当前支持 .docx / .xlsx）`)
}
