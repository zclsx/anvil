export function toolRisk(toolName: string): 'low' | 'medium' | 'high' {
  if (/^(Read|Glob|Grep|LS|WebFetch|WebSearch)$/i.test(toolName)) return 'low'
  if (/^(Bash|Edit|Write|MultiEdit|NotebookEdit)$/i.test(toolName)) return 'high'
  if (toolName === 'mcp__anvil__create_docx' || toolName === 'mcp__anvil__create_docx_from_skill') return 'high'
  if (toolName.startsWith('mcp__')) return 'medium'
  return 'medium'
}
