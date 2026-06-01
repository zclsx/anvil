import type { Item } from '../../store'
import { MarkdownText } from './MarkdownText'
import { ToolStep } from './ToolStep'

type TextVariant = 'final' | 'process'

function textRoleLabel(item: Item, textVariant: TextVariant): string {
  if (item.role === 'assistant') return textVariant === 'final' ? '最终回答' : '回复'
  if (item.role === 'user') return '用户输入'
  return item.role
}

export function MainItemView({
  item,
  isSelected,
  onSelect,
  textVariant = 'final',
}: {
  item: Item
  isSelected: boolean
  onSelect: () => void
  textVariant?: TextVariant
}) {
  const selectedClass = isSelected ? 'border-primary ring-1 ring-primary/35' : 'border-outline-variant hover:border-outline'

  if (item.kind === 'text') {
    const isFinalAssistant = item.role === 'assistant' && textVariant === 'final'
    return (
      <div
        onClick={onSelect}
        className={`cursor-pointer border bg-surface transition-colors ${selectedClass} ${
          isFinalAssistant ? 'border-l-2 border-l-primary px-4 py-3.5' : 'px-3 py-2.5'
        }`}
      >
        <div className={`mb-2 font-label-caps text-[10px] uppercase tracking-wider ${
          isFinalAssistant ? 'text-primary' : 'text-on-surface-variant'
        }`}>
          {textRoleLabel(item, textVariant)}
        </div>
        <div className={isFinalAssistant ? 'text-[13px] leading-relaxed text-on-surface' : 'text-[12px] text-on-surface'}>
          <MarkdownText text={item.text || '...'} />
        </div>
      </div>
    )
  }

  if (item.kind === 'thinking') {
    return (
      <details onClick={onSelect} className="border border-outline-variant/80 bg-surface-container-lowest px-3 py-1.5 opacity-85">
        <summary className="cursor-pointer font-mono-label text-[10px] text-on-surface-variant">
          思考过程 · {item.text.length} chars
        </summary>
        <div className="mt-2 whitespace-pre-wrap text-[12px] italic text-on-surface-variant">{item.text}</div>
      </details>
    )
  }

  if (item.kind === 'tool_use') {
    return (
      <ToolStep item={item} onSelect={onSelect} />
    )
  }

  return (
    <div onClick={onSelect} className={`cursor-pointer border bg-surface-container-low px-3 py-2 opacity-75 transition-colors ${selectedClass}`}>
      <div className="font-mono-label text-[9px] uppercase text-on-surface-variant">{item.role} · {item.kind}</div>
      <div className="text-on-surface text-[11px] whitespace-pre-wrap">{item.text}</div>
    </div>
  )
}
