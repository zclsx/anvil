import { Cpu, Sparkles, UserRound } from 'lucide-react'
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
  if (item.role === 'assistant' && textVariant === 'final') return Sparkles
  return Cpu
}

export function MainItemView({
  item,
  isSelected,
  onSelect,
  textVariant = 'final',
  showRailIcon = true,
}: {
  item: Item
  isSelected: boolean
  onSelect: () => void
  textVariant?: TextVariant
  showRailIcon?: boolean
}) {
  const selectedClass = isSelected ? 'border-primary ring-1 ring-primary/35' : 'border-glass-border hover:border-outline'

  if (item.kind === 'text') {
    const isUser = item.role === 'user'
    const isAssistant = item.role === 'assistant'
    const RoleIcon = textRoleIcon(item, textVariant)
    const timestamp = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

    if (isUser) {
      const userCard = (
        <div
          onClick={onSelect}
          className={`glass-card p-4 rounded-lg rounded-tl-none border transition-colors min-w-0 ${selectedClass}`}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="text-label-mono font-label-mono text-on-surface-variant">{textRoleLabel(item, textVariant)}</div>
            <span className="text-label-mono font-label-mono text-on-surface-variant/50">{timestamp}</span>
          </div>
          <div className="text-body-md font-body-md text-on-surface leading-relaxed">
            <MarkdownText text={item.text || '...'} />
          </div>
        </div>
      )

      if (!showRailIcon) return userCard

      return (
        <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 relative z-10 group">
          {/* User Avatar */}
          <div className="w-12 h-12 rounded-full glass-card flex-shrink-0 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(255,255,255,0.05)] bg-primary/5">
            <RoleIcon size={18} className="text-primary" />
          </div>
          <div className="flex-grow pt-1 min-w-0">
            {userCard}
          </div>
        </div>
      )
    }

    if (isAssistant) {
      const isFinal = textVariant === 'final'
      const assistantCard = (
        <div
          onClick={onSelect}
          className={`glass-card p-4 rounded-lg rounded-tl-none border transition-colors min-w-0 ${selectedClass}`}
        >
          <div className="flex justify-between items-center mb-3">
            <div className="text-label-mono font-label-mono text-on-surface-variant">
              {textRoleLabel(item, textVariant)}
            </div>
            <span className="text-label-mono font-label-mono text-on-surface-variant/50">{timestamp}</span>
          </div>
          <div className="text-body-md font-body-md text-on-surface leading-relaxed">
            <MarkdownText text={item.text || '...'} />
          </div>
        </div>
      )

      if (!showRailIcon) return assistantCard

      return (
        <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 relative z-10 group">
          {/* Assistant Avatar */}
          <div className="w-12 h-12 rounded-full glass-card flex-shrink-0 flex items-center justify-center border border-secondary/20 shadow-[0_0_15px_rgba(255,255,255,0.05)] bg-secondary/5">
            <RoleIcon size={18} className="text-secondary" />
          </div>
          <div className="flex-grow pt-1 min-w-0">
            {assistantCard}
          </div>
        </div>
      )
    }
  }

  if (item.kind === 'thinking') {
    const details = (
      <details onClick={onSelect} className="glass-card border px-3 py-1.5 opacity-75">
        <summary className="cursor-pointer font-mono-label text-[10px] text-on-surface-variant">
          思考过程 · {item.text.length} chars
        </summary>
        <div className="mt-2 whitespace-pre-wrap text-[12px] italic text-on-surface-variant">{item.text}</div>
      </details>
    )

    if (!showRailIcon) return details

    return (
      <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 relative z-10 group">
        {/* Process/Thinking Avatar */}
        <div className="w-12 h-12 rounded-full glass-card flex-shrink-0 flex items-center justify-center border border-secondary/20 shadow-[0_0_15px_rgba(255,255,255,0.05)] bg-secondary/5">
          <Cpu size={18} className="text-secondary" />
        </div>
        <div className="flex-grow pt-1 min-w-0">
          {details}
        </div>
      </div>
    )
  }

  if (item.kind === 'tool_use') {
    return (
      <ToolStep item={item} onSelect={onSelect} />
    )
  }

  const fallback = (
    <div onClick={onSelect} className={`glass-card cursor-pointer border px-3 py-2 opacity-75 transition-colors ${selectedClass}`}>
      <div className="font-mono-label text-[9px] uppercase text-on-surface-variant">{item.role} · {item.kind}</div>
      <div className="text-on-surface text-[11px] whitespace-pre-wrap">{item.text}</div>
    </div>
  )

  if (!showRailIcon) return fallback

  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 relative z-10 group">
      {/* Process/Fallback Avatar */}
      <div className="w-12 h-12 rounded-full glass-card flex-shrink-0 flex items-center justify-center border border-secondary/20 shadow-[0_0_15px_rgba(255,255,255,0.05)] bg-secondary/5">
        <Cpu size={18} className="text-secondary" />
      </div>
      <div className="flex-grow pt-1 min-w-0">
        {fallback}
      </div>
    </div>
  )
}
