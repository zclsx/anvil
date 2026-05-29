import { Trash2 } from 'lucide-react'
import type { SessionMeta } from '../../../electron/shared/session'
import { formatRelative } from '../../lib/timeUtils'
import { formatWorkspaceShort } from '../../lib/pathUtils'

export function SessionItem({
  session,
  isActive,
  onOpen,
  onDelete,
}: {
  session: SessionMeta
  isActive: boolean
  onOpen: (s: SessionMeta) => void
  onDelete: (s: SessionMeta, e: React.MouseEvent) => void
}) {
  return (
    <div
      onClick={() => onOpen(session)}
      className={`group p-2 cursor-pointer text-[11px] border-l-2 transition-colors flex flex-col gap-0.5 ${
        isActive
          ? 'bg-surface-container-high border-primary'
          : 'border-transparent hover:bg-surface-container-high'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-on-surface truncate flex-1 font-body-sm font-medium">
          {session.title || session.id.slice(0, 12)}
        </span>
        <button
          onClick={(e) => onDelete(session, e)}
          className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-[#ff8080] p-0.5"
        >
          <Trash2 size={10} />
        </button>
      </div>
      <div className="flex items-center gap-2 font-mono-label text-[9px] text-on-surface-variant">
        <span>{session.turnCount}t</span>
        <span className={
          session.lastStatus === 'failed' ? 'text-[#ff8080]' :
          session.lastStatus === 'running' ? 'text-[#4a9eff]' :
          'text-[#6fbf6f]'
        }>
          {session.lastStatus}
        </span>
        <span>{formatRelative(session.updatedAt)}</span>
      </div>
      <div className="font-mono-code text-[9px] text-on-surface-variant truncate">
        {formatWorkspaceShort(session.workspacePath)}
      </div>
    </div>
  )
}
