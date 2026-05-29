import type { Item } from '../../store'
import { MarkdownText } from './MarkdownText'
import { GeneratedFileChip } from './GeneratedFileChip'
import { getGeneratedDocxPath } from '../../lib/generatedFiles'

export function MainItemView({
  item,
  isSelected,
  onSelect,
  workspacePath,
}: {
  item: Item
  isSelected: boolean
  onSelect: () => void
  workspacePath?: string
}) {
  const baseClass = `p-3 border cursor-pointer transition-colors ${isSelected ? 'border-primary' : 'border-outline-variant hover:border-outline'}`

  if (item.kind === 'text') {
    return (
      <div onClick={onSelect} className={`${baseClass} bg-surface-container-low`}>
        <div className="font-mono-label text-[9px] text-on-surface-variant uppercase mb-1.5 tracking-wider">
          {item.role === 'assistant' ? 'Assistant' : item.role}
        </div>
        <MarkdownText text={item.text || '...'} />
      </div>
    )
  }

  if (item.kind === 'thinking') {
    return (
      <details onClick={onSelect} className={`${baseClass} bg-surface-container-low`}>
        <summary className="font-mono-label text-[9px] text-on-surface-variant uppercase cursor-pointer">
          Thinking ({item.text.length} chars)
        </summary>
        <div className="text-on-surface-variant text-[12px] mt-2 italic whitespace-pre-wrap">{item.text}</div>
      </details>
    )
  }

  if (item.kind === 'tool_use') {
    const decisionLabel =
      item.approvalDecision === 'allow' ? '✓ allowed' :
      item.approvalDecision === 'deny' ? '✕ denied' :
      item.approvalId ? '⏳ awaiting approval' : null

    const generatedDocxPath = getGeneratedDocxPath(item)

    return (
      <div onClick={onSelect} className={`${baseClass} bg-surface-container-low`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono-label text-[9px] text-[#f59e0b] uppercase tracking-wider">🔧 {item.toolName}</span>
          {item.approvalRisk && (
            <span className={`text-[9px] font-mono-label uppercase ${
              item.approvalRisk === 'high' ? 'text-[#ff8080]' :
              item.approvalRisk === 'medium' ? 'text-[#f59e0b]' :
              'text-on-surface-variant'
            }`}>{item.approvalRisk} risk</span>
          )}
          {decisionLabel && (
            <span className={`text-[9px] font-mono-label uppercase ${
              item.approvalDecision === 'deny' ? 'text-[#ff8080]' :
              item.approvalDecision === 'allow' ? 'text-[#6fbf6f]' :
              'text-[#f59e0b]'
            }`}>{decisionLabel}</span>
          )}
          {item.toolOutput == null && (
            <span className="text-[9px] font-mono-label text-[#4a9eff] uppercase">running</span>
          )}
          {item.toolIsError && (
            <span className="text-[9px] font-mono-label text-[#ff8080] uppercase">error</span>
          )}
        </div>
        <div className="font-mono-code text-[11px] text-on-surface-variant truncate">
          {typeof item.toolInput === 'string' ? item.toolInput : JSON.stringify(item.toolInput || {}).slice(0, 200)}
        </div>
        {generatedDocxPath && (
          <GeneratedFileChip absPath={generatedDocxPath} workspacePath={workspacePath} />
        )}
      </div>
    )
  }

  return (
    <div onClick={onSelect} className={`${baseClass} bg-surface-container-low opacity-75`}>
      <div className="font-mono-label text-[9px] text-on-surface-variant uppercase">{item.role} · {item.kind}</div>
      <div className="text-on-surface text-[11px] whitespace-pre-wrap">{item.text}</div>
    </div>
  )
}
