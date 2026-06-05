import { FileSearch } from 'lucide-react'
import type { Item, PendingApproval, Turn } from '../../store'
import type { RightTab } from '../../hooks/useRightPanelTabs'
import { Inspector } from '../Inspector'
import { TabStrip } from './TabStrip'
import { DocumentPreview } from './DocumentPreview'
import { TaskWorkbench } from './TaskWorkbench'

export function RightPanel({
  width,
  tabs,
  activeTabId,
  items,
  turns,
  pendingApprovals,
  workspacePath,
  onActivate,
  onClose,
  onInspectItem,
}: {
  width: number
  tabs: RightTab[]
  activeTabId: string | null
  items: Record<string, Item>
  turns: Turn[]
  pendingApprovals: PendingApproval[]
  workspacePath?: string
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onInspectItem: (itemId: string) => void
}) {
  const active = tabs.find((t) => t.id === activeTabId) ?? null

  return (
    <aside
      style={{ width }}
      className="glass-panel shrink-0 border-l overflow-hidden no-drag flex flex-col"
    >
      {tabs.length > 0 && (
        <TabStrip tabs={tabs} activeTabId={activeTabId} onActivate={onActivate} onClose={onClose} />
      )}
      {active ? (
        active.kind === 'task' ? (
          <TaskWorkbench
            turns={turns}
            items={items}
            pendingApprovals={pendingApprovals}
            workspacePath={workspacePath}
            onInspectItem={onInspectItem}
          />
        ) : active.kind === 'preview' ? (
          <DocumentPreview key={active.id} filePath={active.filePath} />
        ) : items[active.itemId] ? (
          <Inspector item={items[active.itemId]} />
        ) : (
          <EmptyState />
        )
      ) : (
        <EmptyState />
      )}
    </aside>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant italic text-[11px] opacity-75 p-4 text-center">
      <FileSearch size={24} className="mb-2 opacity-40" />
      点击左侧 conversation item 查看详情
    </div>
  )
}
