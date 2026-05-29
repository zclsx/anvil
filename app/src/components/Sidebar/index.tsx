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
    <nav className="flex flex-col bg-surface-container text-primary w-[260px] border-r border-outline-variant shrink-0 z-0 no-drag">
      <div className="p-3 border-b border-outline-variant flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold flex items-center gap-1">
            <History size={11} /> Sessions ({sessions.length})
          </span>
          <button
            onClick={onRefresh}
            className="text-on-surface-variant hover:text-primary p-0.5 cursor-pointer"
            title="刷新"
          >
            <RotateCw size={11} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {sessions.length === 0 && (
          <div className="text-on-surface-variant italic text-[11px] p-2">还没有 session</div>
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
