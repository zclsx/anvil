import { History, RotateCw } from 'lucide-react'
import type { SessionMeta } from '../../../electron/shared/session'
import { SessionItem } from './SessionItem'

export function Sidebar({
  sessions,
  activeSessionId,
  onRefresh,
  onOpenSession,
  onDeleteSession,
}: {
  sessions: SessionMeta[]
  activeSessionId: string | null
  onRefresh: () => void
  onOpenSession: (s: SessionMeta) => void
  onDeleteSession: (s: SessionMeta, e: React.MouseEvent) => void
}) {
  return (
    <nav className="no-drag z-0 flex w-[260px] shrink-0 flex-col border-r border-outline-variant bg-surface-container text-primary">
      <div className="flex shrink-0 flex-col gap-2 border-b border-outline-variant px-3 py-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-label-caps text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            <History size={11} />
            会话
            <span className="font-mono-code text-[9px] text-on-surface-variant/80">{sessions.length}</span>
          </span>
          <button
            onClick={onRefresh}
            className="cursor-pointer border border-transparent p-1 text-on-surface-variant transition-colors hover:border-outline-variant hover:bg-surface-container-high hover:text-primary"
            title="刷新"
          >
            <RotateCw size={11} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {sessions.length === 0 && (
          <div className="p-3 text-[11px] text-on-surface-variant">暂无会话</div>
        )}
        {sessions.map((s) => (
          <SessionItem
            key={s.id}
            session={s}
            isActive={activeSessionId === s.id}
            onOpen={onOpenSession}
            onDelete={onDeleteSession}
          />
        ))}
      </div>
    </nav>
  )
}
