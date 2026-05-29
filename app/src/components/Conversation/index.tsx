import { FileSearch } from 'lucide-react'
import type { Item, Turn } from '../../store'
import { formatWorkspaceShort } from '../../lib/pathUtils'
import { MainItemView } from './MainItemView'
import { UserEchoCard } from './UserEchoCard'
import { ThinkingIndicator } from './ThinkingIndicator'

export function Conversation({
  turns,
  items,
  running,
  pendingWorkspace,
  pendingPrompt,
  selectedItemId,
  autoFollow,
  awaitingFirstItem,
  loadingAnchorRef,
  conversationEndRef,
  onSelectItem,
  displayWorkspace,
}: {
  turns: Turn[]
  items: Record<string, Item>
  running: boolean
  pendingWorkspace: string | null
  pendingPrompt: string | null
  selectedItemId: string | null
  autoFollow: boolean
  awaitingFirstItem: boolean
  loadingAnchorRef: React.RefObject<HTMLDivElement | null>
  conversationEndRef: React.RefObject<HTMLDivElement | null>
  onSelectItem: (id: string) => void
  displayWorkspace?: string
}) {
  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
      {turns.length === 0 && !running && (
        <div className="text-center text-on-surface-variant italic text-[12px] opacity-75 py-12 flex flex-col items-center gap-2">
          <FileSearch size={28} />
          <div>
            {pendingWorkspace
              ? `Workspace 已就绪：${formatWorkspaceShort(pendingWorkspace)}，请在下方输入指令`
              : '点 New 选择 workspace 开始新对话，或从左侧选择历史 session'}
          </div>
        </div>
      )}
      {turns.map((turn) => {
        if (turn.status === 'running' && turn.itemIds.length === 0) return null
        return (
          <div key={turn.id} className="flex flex-col gap-2.5">
            {turn.itemIds.map((id) => {
              const item = items[id]
              if (!item) return null
              return (
                <MainItemView
                  key={id}
                  item={item}
                  isSelected={selectedItemId === id}
                  onSelect={() => onSelectItem(id)}
                  workspacePath={displayWorkspace}
                />
              )
            })}
            {turn.status !== 'running' && turn.stats && (
              <div className="text-[10px] font-mono-label text-on-surface-variant flex gap-3 px-1">
                <span className={
                  turn.status === 'failed' ? 'text-[#ff8080]' : 'text-[#6fbf6f]'
                }>{turn.status}</span>
                {turn.stats.durationMs && <span>{(turn.stats.durationMs / 1000).toFixed(1)}s</span>}
                {turn.stats.outputTokens != null && <span>{turn.stats.outputTokens} out</span>}
                {turn.stats.cacheReadTokens != null && turn.stats.cacheReadTokens > 0 && (
                  <span>cache: {turn.stats.cacheReadTokens}</span>
                )}
                {turn.stats.costUsd != null && <span>${turn.stats.costUsd.toFixed(4)}</span>}
              </div>
            )}
          </div>
        )
      })}
      {awaitingFirstItem && (
        <>
          {pendingPrompt && <UserEchoCard prompt={pendingPrompt} />}
          <ThinkingIndicator
            hasTurnStarted={turns.length > 0}
            anchorRef={loadingAnchorRef}
            autoFollow={autoFollow}
          />
        </>
      )}
      <div ref={conversationEndRef} aria-hidden="true" className="h-px shrink-0" />
    </div>
  )
}
