import { ChevronRight, Cpu } from 'lucide-react'
import type { Item } from '../../store'
import { RoleIconTile, RoleLabel } from '../RoleIconTile'
import { MainItemView } from './MainItemView'
import { StatusDot } from '../StatusDot'

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
      <div className="glass-card min-w-0 overflow-hidden border">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={onToggle}
          className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-glass-surface-strong focus-ring"
        >
          <ChevronRight
            size={13}
            className={`shrink-0 text-on-surface-variant transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
          <RoleLabel tone="process">
            过程
          </RoleLabel>
          <span className="font-mono-label text-[10px] text-on-surface-variant/75">
            · {items.length} 步
          </span>
          {isRunning && (
            <StatusDot tone="running" label="运行中" className="ml-auto" />
          )}
        </button>

        {isExpanded && (
          <div className="flex flex-col gap-2 border-t border-glass-border bg-glass-surface-muted px-2.5 py-2.5">
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
