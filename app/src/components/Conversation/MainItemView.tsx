import { CheckCircle2, Cpu, Sparkles, UserRound } from 'lucide-react'
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
  if (item.role === 'assistant' && textVariant === 'final') return CheckCircle2
  return Cpu
}

function formatItemTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
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
    const roleTone = textRoleTone(item, textVariant)
    const RoleIcon = textRoleIcon(item, textVariant)
    const card = (
      <div
        onClick={onSelect}
        className={`glass-card min-w-0 cursor-pointer rounded-lg rounded-tl-none border p-4 transition-colors ${selectedClass}`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center">
            <RoleLabel tone={roleTone} className="text-label-mono font-label-mono">
              {textRoleLabel(item, textVariant)}
            </RoleLabel>
          </div>
          <span className="shrink-0 text-label-mono font-label-mono text-on-surface-variant/50">
            {formatItemTime(item.createdAt)}
          </span>
        </div>
        <div className="text-body-md font-body-md leading-relaxed text-on-surface">
          <MarkdownText text={item.text || '...'} />
        </div>
      </div>
    )

    if (!showRailIcon) return card

    return (
      <div className="relative z-10 grid grid-cols-[48px_minmax(0,1fr)] gap-4 group">
        <RoleIconTile icon={RoleIcon} tone={roleTone} size="lg" shape="circle" elevated />
        <div className="min-w-0 flex-grow pt-1">
          {card}
        </div>
      </div>
    )
  }

  if (item.kind === 'thinking') {
    const details = (
      <details
        onClick={onSelect}
        className="glass-card rounded border border-glass-border bg-surface-container-lowest/20 p-3 transition-colors hover:bg-surface-container-high/20"
      >
        <summary className="flex cursor-pointer select-none items-center gap-2 text-body-md font-medium text-on-surface">
          <Sparkles size={14} className="shrink-0 text-info-text-accent" />
          <span>思考过程</span>
          <span className="ml-auto text-label-mono font-label-mono text-on-surface-variant/50">
            {item.text.length} 字符
          </span>
        </summary>
        <div className="mt-3 whitespace-pre-wrap border-t border-glass-border/40 pt-2.5 font-mono-code text-[12px] leading-relaxed text-on-surface-variant">
          {item.text}
        </div>
      </details>
    )

    if (!showRailIcon) return details

    return (
      <div className="relative z-10 grid grid-cols-[48px_minmax(0,1fr)] gap-4 group">
        <RoleIconTile icon={Cpu} tone="process" size="lg" shape="circle" elevated />
        <div className="min-w-0 flex-grow pt-1">
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
    <div
      onClick={onSelect}
      className={`glass-card cursor-pointer rounded border bg-surface-container-lowest/30 p-3 transition-colors hover:bg-surface-container-high/30 ${selectedClass}`}
    >
      <div className="mb-1.5 font-label-mono text-label-mono uppercase text-on-surface-variant">
        {item.role} · {item.kind}
      </div>
      <div className="whitespace-pre-wrap break-words text-body-md font-body-md leading-relaxed text-on-surface">
        {item.text}
      </div>
    </div>
  )

  if (!showRailIcon) return fallback

  return (
    <div className="relative z-10 grid grid-cols-[48px_minmax(0,1fr)] gap-4 group">
      <RoleIconTile icon={Cpu} tone="process" size="lg" shape="circle" elevated />
      <div className="min-w-0 flex-grow pt-1">
        {fallback}
      </div>
    </div>
  )
}
