import { X } from 'lucide-react'
import type { RightTab } from '../../hooks/useRightPanelTabs'

function tabLabel(tab: RightTab): string {
  return tab.kind === 'preview' ? tab.title : '详情'
}

export function TabStrip({
  tabs,
  activeTabId,
  onActivate,
  onClose,
}: {
  tabs: RightTab[]
  activeTabId: string | null
  onActivate: (id: string) => void
  onClose: (id: string) => void
}) {
  return (
    <div className="flex border-b border-outline-variant bg-surface-container-low shrink-0 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onActivate(tab.id)}
          className={`group flex items-center gap-1.5 px-3 py-1.5 border-r border-outline-variant cursor-pointer max-w-[160px] shrink-0 ${
            tab.id === activeTabId
              ? 'bg-surface-container text-primary'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="font-mono-label text-[10px] truncate">{tabLabel(tab)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose(tab.id)
            }}
            aria-label="关闭标签"
            className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-primary cursor-pointer shrink-0"
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  )
}
