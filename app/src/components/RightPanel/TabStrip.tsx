import { X } from 'lucide-react'
import type { RightTab } from '../../hooks/useRightPanelTabs'

function tabLabel(tab: RightTab): string {
  if (tab.kind === 'task') return '任务'
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
    <div className="flex shrink-0 overflow-x-auto border-b border-glass-border bg-glass-surface-muted">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`group relative flex max-w-[180px] shrink-0 items-center gap-1.5 border-r border-glass-border px-2 py-1.5 transition-colors ${
            tab.id === activeTabId
              ? 'bg-glass-surface-strong text-primary'
              : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
          }`}
        >
          <button
            onClick={() => onActivate(tab.id)}
            className="min-w-0 flex-1 cursor-pointer truncate py-0.5 text-left font-mono-label text-[10px] tracking-wider focus-ring"
          >
            {tabLabel(tab)}
          </button>
          {tab.kind !== 'task' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.id)
              }}
              aria-label="关闭标签"
              className="shrink-0 cursor-pointer text-on-surface-variant opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
            >
              <X size={11} />
            </button>
          )}
          {tab.id === activeTabId && <span className="absolute bottom-0 left-0 h-[2px] w-full bg-primary" />}
        </div>
      ))}
    </div>
  )
}
