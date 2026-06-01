import { Trash2 } from 'lucide-react'
import type { SessionMeta } from '../../../electron/shared/session'
import { formatRelative } from '../../lib/timeUtils'
import { formatWorkspaceShort } from '../../lib/pathUtils'
import { StatusDot, type StatusTone } from '../StatusDot'

function getStatusMeta(status: SessionMeta['lastStatus']): { tone: StatusTone; label: string } {
  switch (status) {
    case 'running':
      return { tone: 'running', label: '运行' }
    case 'completed':
      return { tone: 'success', label: '完成' }
    case 'failed':
      return { tone: 'danger', label: '失败' }
    case 'cancelled':
      return { tone: 'warning', label: '取消' }
    case 'unknown':
      return { tone: 'idle', label: '待机' }
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

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
  const status = getStatusMeta(session.lastStatus)

  return (
    <div
      onClick={() => onOpen(session)}
      className={`group flex cursor-pointer flex-col gap-1 border-l-2 px-3 py-2.5 text-[11px] transition-colors ${
        isActive
          ? 'border-primary bg-surface-container-high text-primary'
          : 'border-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`min-w-0 flex-1 truncate font-body-sm font-medium ${isActive ? 'text-primary' : 'text-on-surface'}`}>
          {session.title || session.id.slice(0, 12)}
        </span>
        <button
          onClick={(e) => onDelete(session, e)}
          className="cursor-pointer p-0.5 text-on-surface-variant opacity-0 transition-opacity hover:text-status-danger group-hover:opacity-100"
          title="删除"
        >
          <Trash2 size={10} />
        </button>
      </div>
      <div className="flex items-center gap-2 font-mono-label text-[9px] uppercase tracking-wider text-on-surface-variant">
        <StatusDot tone={status.tone} label={status.label} />
        <span>{session.turnCount}t</span>
        <span>{formatRelative(session.updatedAt)}</span>
      </div>
      <div className="truncate font-mono-code text-[9px] text-on-surface-variant">
        {formatWorkspaceShort(session.workspacePath)}
      </div>
    </div>
  )
}
