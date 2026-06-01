import { ChevronRight } from 'lucide-react'
import type { Item } from '../../store'
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
    <div className="border border-outline-variant bg-surface-container-lowest">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-container-low focus-ring"
      >
        <ChevronRight
          size={13}
          className={`shrink-0 text-on-surface-variant transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
        <span className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant">
          过程
        </span>
        <span className="font-mono-label text-[10px] text-on-surface-variant/75">
          · {items.length} 步
        </span>
        {isRunning && (
          <StatusDot tone="running" label="运行中" className="ml-auto font-mono-label text-[9px] uppercase text-on-surface-variant" />
        )}
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-2 border-t border-outline-variant bg-surface-container-low px-2.5 py-2.5">
          {items.map((item) => (
            <MainItemView
              key={item.id}
              item={item}
              isSelected={selectedItemId === item.id}
              onSelect={() => onSelectItem(item.id)}
              textVariant="process"
            />
          ))}
        </div>
      )}
    </div>
  )
}
