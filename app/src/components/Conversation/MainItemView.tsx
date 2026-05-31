import type { Item } from '../../store'
import { MarkdownText } from './MarkdownText'
import { ToolStep } from './ToolStep'

export function MainItemView({
  item,
  isSelected,
  onSelect,
  workspacePath,
  expandAll,
}: {
  item: Item
  isSelected: boolean
  onSelect: () => void
  workspacePath?: string
  expandAll: boolean
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
      <details onClick={onSelect} className="border border-outline-variant bg-surface-container-low px-3 py-1.5">
        <summary className="font-mono-label text-[10px] text-on-surface-variant cursor-pointer">
          💭 thinking · {item.text.length} chars
        </summary>
        <div className="text-on-surface-variant text-[12px] mt-2 italic whitespace-pre-wrap">{item.text}</div>
      </details>
    )
  }

  if (item.kind === 'tool_use') {
    return (
      <ToolStep item={item} expandAll={expandAll} onSelect={onSelect} workspacePath={workspacePath} />
    )
  }

  return (
    <div onClick={onSelect} className={`${baseClass} bg-surface-container-low opacity-75`}>
      <div className="font-mono-label text-[9px] text-on-surface-variant uppercase">{item.role} · {item.kind}</div>
      <div className="text-on-surface text-[11px] whitespace-pre-wrap">{item.text}</div>
    </div>
  )
}
