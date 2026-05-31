import type { Item } from '../store'

const PREVIEW_CHARS = 120

export function cleanToolName(toolName?: string): string {
  if (!toolName) return 'tool'
  return toolName.replace(/^mcp__[a-z0-9]+__/i, '')
}

function outputToText(output: unknown): string {
  if (output == null) return ''
  if (typeof output === 'string') return output
  if (Array.isArray(output)) {
    return output
      .map((part) =>
        part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
          ? (part as { text: string }).text
          : '',
      )
      .filter(Boolean)
      .join('\n')
  }
  if (typeof output === 'object') {
    const content = (output as { content?: unknown }).content
    if (Array.isArray(content)) return outputToText(content)
    const text = (output as { text?: unknown }).text
    if (typeof text === 'string') return text
  }
  return ''
}

export interface ToolStepSummary {
  label: string
  argPreview: string
  resultPreview: string
  extraLines: number
  hasOutput: boolean
  isError: boolean
  approvalLabel: string | null
  risk: 'low' | 'medium' | 'high' | null
}

type ToolItem = Pick<
  Item,
  'toolName' | 'toolInput' | 'toolOutput' | 'toolIsError' | 'approvalId' | 'approvalDecision' | 'approvalRisk'
>

export function toolStepSummary(item: ToolItem): ToolStepSummary {
  const input = item.toolInput
  let argPreview = ''
  if (input && typeof input === 'object') {
    const path = (input as { path?: unknown }).path
    argPreview = typeof path === 'string' ? path : JSON.stringify(input).slice(0, PREVIEW_CHARS)
  } else if (typeof input === 'string') {
    argPreview = input.slice(0, PREVIEW_CHARS)
  }

  const outText = outputToText(item.toolOutput).trim()
  const lines = outText ? outText.split('\n') : []
  const resultPreview = (lines[0] ?? '').slice(0, PREVIEW_CHARS)

  const approvalLabel =
    item.approvalDecision === 'allow'
      ? '✓ allowed'
      : item.approvalDecision === 'deny'
        ? '✕ denied'
        : item.approvalId
          ? '⏳ awaiting'
          : null

  return {
    label: cleanToolName(item.toolName),
    argPreview,
    resultPreview,
    extraLines: Math.max(0, lines.length - 1),
    hasOutput: item.toolOutput != null,
    isError: item.toolIsError === true,
    approvalLabel,
    risk: item.approvalRisk ?? null,
  }
}

export function fullToolOutputText(output: unknown): string {
  return outputToText(output)
}
