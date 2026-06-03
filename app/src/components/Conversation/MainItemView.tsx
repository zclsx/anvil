import { Bot, Cpu, UserRound } from 'lucide-react'
import type { Item } from '../../store'
import { RoleIconTile, RoleLabel, type RoleTone } from '../RoleIconTile'
import { MarkdownText } from './MarkdownText'
import { ToolStep } from './ToolStep'

type TextVariant = 'final' | 'process'

function textRoleLabel(item: Item, textVariant: TextVariant): string {
  if (item.role === 'assistant') return textVariant === 'final' ? '最终回答' : '回复'
  if (item.role === 'user') return '用户输入'
  return item.role
}

function textRoleTone(item: Item, textVariant: TextVariant): RoleTone {
  if (item.role === 'user') return 'user'
  if (item.role === 'assistant' && textVariant === 'final') return 'final'
  return 'process'
}

function textRoleIcon(item: Item, textVariant: TextVariant) {
  if (item.role === 'user') return UserRound
  if (item.role === 'assistant' && textVariant === 'final') return Bot
  return Cpu
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
  const selectedClass = isSelected ? 'border-primary ring-1 ring-primary/35' : 'border-glass-border hover:border-outline'

  if (item.kind === 'text') {
    const isFinalAssistant = item.role === 'assistant' && textVariant === 'final'
    const roleTone = textRoleTone(item, textVariant)
    const RoleIcon = textRoleIcon(item, textVariant)
    return (
      <div
        onClick={onSelect}
        className={`grid cursor-pointer grid-cols-[32px_minmax(0,1fr)] gap-3 border transition-colors ${
          isFinalAssistant ? 'glass-card-strong border-l-2 border-l-primary px-4 py-3.5' : 'glass-card px-3 py-2.5'
        } ${selectedClass} ${
          isFinalAssistant ? 'relative overflow-hidden' : ''
        }`}
      >
        <RoleIconTile icon={RoleIcon} tone={roleTone} />
        <div className="min-w-0 relative z-[1]">
          <div className="mb-2">
            <RoleLabel tone={roleTone}>
              {textRoleLabel(item, textVariant)}
            </RoleLabel>
          </div>
          <div className={isFinalAssistant ? 'text-[13px] leading-relaxed text-on-surface' : 'text-[12px] text-on-surface'}>
            <MarkdownText text={item.text || '...'} />
          </div>
        </div>
      </div>
    )
  }

  if (item.kind === 'thinking') {
    return (
      <details onClick={onSelect} className="glass-card border px-3 py-1.5 opacity-75">
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
    <div onClick={onSelect} className={`glass-card cursor-pointer border px-3 py-2 opacity-75 transition-colors ${selectedClass}`}>
      <div className="font-mono-label text-[9px] uppercase text-on-surface-variant">{item.role} · {item.kind}</div>
      <div className="text-on-surface text-[11px] whitespace-pre-wrap">{item.text}</div>
    </div>
  )
}
