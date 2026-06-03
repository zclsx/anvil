import type { Item, Turn } from '../store'

const CREATE_DOCX_TOOL_NAMES = new Set([
  'mcp__anvil__create_docx',
  'mcp__anvil__create_docx_from_skill',
])

export type GeneratedDocxArtifact =
  | {
      itemId: string
      status: 'pending'
      name: string
    }
  | {
      itemId: string
      status: 'success'
      name: string
      path: string
    }
  | {
      itemId: string
      status: 'failed'
      name: string
      error: string
    }

function toolOutputToText(toolOutput: unknown): string {
  if (typeof toolOutput === 'string') return toolOutput
  if (Array.isArray(toolOutput)) {
    return toolOutput
      .map((part) =>
        part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
          ? (part as { text: string }).text
          : '',
      )
      .join('\n')
  }
  if (toolOutput && typeof toolOutput === 'object') {
    const content = (toolOutput as { content?: unknown }).content
    if (Array.isArray(content)) return toolOutputToText(content)
    const text = (toolOutput as { text?: unknown }).text
    if (typeof text === 'string') return text
  }
  return ''
}

function isCreateDocxTool(toolName: string | undefined): boolean {
  return toolName != null && CREATE_DOCX_TOOL_NAMES.has(toolName)
}

function pathBasename(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '')
  const last = normalized.split('/').pop()
  return last && last.length > 0 ? last : 'Word 文档'
}

function readStringField(value: unknown, names: string[]): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const name of names) {
    const field = record[name]
    if (typeof field === 'string' && field.trim().length > 0) return field.trim()
  }
  return null
}

function toolInputDisplayName(toolInput: unknown): string {
  const path = readStringField(toolInput, ['path', 'output_path', 'outputPath', 'file_path', 'filePath'])
  return path ? pathBasename(path) : 'Word 文档'
}

function shortToolError(toolOutput: unknown): string {
  const text = toolOutputToText(toolOutput)
    .replace(/<tool_use_error>|<\/tool_use_error>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return '未知错误'
  return text.length > 160 ? `${text.slice(0, 157)}...` : text
}

/**
 * Extract the absolute path of a generated .docx from a create_docx tool
 * result. Reads only the structured tool output (never assistant prose), so
 * a hallucinated path in the model's text can't become a clickable file.
 * Returns null if no .docx path is present.
 */
export function parseCreatedDocxPath(toolOutput: unknown): string | null {
  const text = toolOutputToText(toolOutput)
  if (!text) return null
  const match = /((?:\/|[A-Za-z]:\\)[^\n]*?\.docx)(?=$|\s)/m.exec(text)
  return match ? match[1].trim() : null
}

/**
 * Resolve the generated-file path for a conversation item, or null when the
 * item isn't a successful create_docx call. Derived purely from persisted
 * item fields so it survives session replay.
 */
export function getGeneratedDocxPath(
  item: Pick<Item, 'toolName' | 'toolOutput' | 'toolIsError'>,
): string | null {
  if (!isCreateDocxTool(item.toolName)) return null
  if (item.toolIsError === true) return null
  return parseCreatedDocxPath(item.toolOutput)
}

/**
 * Resolve generated document artifacts for a whole turn. This is used by the
 * final response area so users don't have to scroll back to the tool card.
 * It still reads only persisted structured tool output.
 */
export function getGeneratedDocxPathsForTurn(
  turn: Pick<Turn, 'itemIds'>,
  items: Record<string, Pick<Item, 'toolName' | 'toolOutput' | 'toolIsError'> | undefined>,
): string[] {
  const paths: string[] = []
  const seen = new Set<string>()
  for (const id of turn.itemIds) {
    const item = items[id]
    if (!item) continue
    const docxPath = getGeneratedDocxPath(item)
    if (!docxPath || seen.has(docxPath)) continue
    seen.add(docxPath)
    paths.push(docxPath)
  }
  return paths
}

export function getGeneratedDocxArtifactsForTurn(
  turn: Pick<Turn, 'itemIds'>,
  items: Record<string, Pick<Item, 'id' | 'toolName' | 'toolInput' | 'toolOutput' | 'toolIsError' | 'approvalDecision'> | undefined>,
): GeneratedDocxArtifact[] {
  const artifacts: GeneratedDocxArtifact[] = []
  const seenItemIds = new Set<string>()
  const seenSuccessPaths = new Set<string>()

  for (const id of turn.itemIds) {
    if (seenItemIds.has(id)) continue
    seenItemIds.add(id)

    const item = items[id]
    if (!item || !isCreateDocxTool(item.toolName)) continue

    const inputName = toolInputDisplayName(item.toolInput)
    if (item.toolIsError === true) {
      artifacts.push({
        itemId: id,
        status: 'failed',
        name: inputName,
        error: shortToolError(item.toolOutput),
      })
      continue
    }

    if (item.toolOutput == null) {
      if (item.approvalDecision === 'deny') continue
      artifacts.push({
        itemId: id,
        status: 'pending',
        name: inputName,
      })
      continue
    }

    const docxPath = getGeneratedDocxPath(item)
    if (!docxPath || seenSuccessPaths.has(docxPath)) continue
    seenSuccessPaths.add(docxPath)
    artifacts.push({
      itemId: id,
      status: 'success',
      path: docxPath,
      name: pathBasename(docxPath),
    })
  }

  return artifacts
}
