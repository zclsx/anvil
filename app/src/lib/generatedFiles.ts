import type { Item } from '../store'

const CREATE_DOCX_TOOL_NAME = 'mcp__anvil__create_docx'

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
  if (item.toolName !== CREATE_DOCX_TOOL_NAME) return null
  if (item.toolIsError === true) return null
  return parseCreatedDocxPath(item.toolOutput)
}
