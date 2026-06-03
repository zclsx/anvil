import { ChevronRight, Cpu } from 'lucide-react'
import type { Item } from '../../store'
import { MainItemView } from './MainItemView'

export function ProcessGroup({
  items,
  isRunning,
  isExpanded,
  selectedItemId,
  onToggle,
  onSelectItem,
}: {
  items: Item[]
  isRunning: boolean
  isExpanded: boolean
  selectedItemId: string | null
  onToggle: () => void
  onSelectItem: (id: string) => void
}) {
  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 relative z-10 group">
      {/* Process Group Avatar */}
      <div className="w-12 h-12 rounded-full glass-card flex-shrink-0 flex items-center justify-center border border-secondary/20 shadow-[0_0_15px_rgba(255,255,255,0.05)] bg-secondary/5">
        <Cpu size={18} className="text-secondary" />
      </div>
      <div className="glass-card min-w-0 overflow-hidden border border-outline-variant rounded-lg rounded-tl-none group-hover:border-secondary/30 transition-colors">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={onToggle}
          className="flex w-full items-center justify-between px-4 py-3 bg-surface-container-high/20 cursor-pointer hover:bg-surface-container-high/40 transition-colors focus-ring"
        >
          <div className="flex items-center gap-3">
            <span className="text-body-md font-body-md font-medium text-on-surface">过程执行</span>
            {isRunning ? (
              <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold bg-status-running-bg/25 text-status-running-text border border-status-running-border/30">
                运行中
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold bg-status-success-chip-bg text-status-success border border-status-success-border/30">
                已完成
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-label-mono font-label-mono text-on-surface-variant">
              {items.length} 步
            </span>
            <ChevronRight
              size={14}
              className={`text-on-surface-variant transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
            />
          </div>
        </button>

        {isExpanded && (
          <div className="flex flex-col gap-2 border-t border-glass-border bg-surface-container-lowest/10 px-2.5 py-2.5">
            {items.map((item) => (
              <MainItemView
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                onSelect={() => onSelectItem(item.id)}
                textVariant="process"
                showRailIcon={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
