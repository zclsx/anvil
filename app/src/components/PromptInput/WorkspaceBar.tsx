import { FolderOpen } from 'lucide-react'
import type { SessionMeta } from '../../../electron/shared/session'
import { formatWorkspaceShort } from '../../lib/pathUtils'

export function WorkspaceBar({
  displayWorkspace,
  activeSession,
  pendingWorkspace,
  isDraftWorkspace,
  running,
  onChangeDraftWorkspace,
}: {
  displayWorkspace: string
  activeSession: SessionMeta | null
  pendingWorkspace: string | null
  isDraftWorkspace: boolean
  running: boolean
  onChangeDraftWorkspace: () => void
}) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono-label text-on-surface-variant">
      <FolderOpen
        size={12}
        className={displayWorkspace ? 'text-[#a0c4ff]' : 'text-on-surface-variant'}
      />
      <span className="uppercase shrink-0">
        {activeSession ? 'session workspace' : pendingWorkspace ? 'draft workspace' : 'workspace'}
      </span>
      <span className="font-mono-code truncate flex-1">
        {displayWorkspace ? formatWorkspaceShort(displayWorkspace) : 'none selected'}
      </span>
      {isDraftWorkspace && !running && (
        <button
          onClick={onChangeDraftWorkspace}
          className="text-[10px] font-mono-label text-[#a0c4ff] hover:text-primary cursor-pointer px-2"
        >
          更改
        </button>
      )}
    </div>
  )
}
