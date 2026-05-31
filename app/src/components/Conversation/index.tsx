import { FileSearch } from 'lucide-react'
import type { Item, Turn } from '../../store'
import { formatWorkspaceShort } from '../../lib/pathUtils'
import { getGeneratedDocxPathsForTurn } from '../../lib/generatedFiles'
import { MainItemView } from './MainItemView'
import { UserEchoCard } from './UserEchoCard'
import { ThinkingIndicator } from './ThinkingIndicator'
import { GeneratedFilesPanel } from './GeneratedFilesPanel'

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
  expandAll,
  onToggleExpand,
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
  expandAll: boolean
  onToggleExpand: () => void
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
      {turns.length > 0 && (
        <div className="sticky top-0 z-10 flex justify-end pointer-events-none -mt-2 -mb-2">
          <button
            onClick={onToggleExpand}
            className="pointer-events-auto font-mono-label text-[10px] text-on-surface-variant hover:text-primary bg-surface-container border border-outline-variant px-2 py-0.5 cursor-pointer"
          >
            {expandAll ? '收起过程' : '展开过程'} <span className="opacity-50">⌘E</span>
          </button>
        </div>
      )}
      {turns.map((turn) => {
        if (turn.status === 'running' && turn.itemIds.length === 0) return null
        const generatedDocxPaths = getGeneratedDocxPathsForTurn(turn, items)
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
                  expandAll={expandAll}
                />
              )
            })}
            {turn.status !== 'running' && generatedDocxPaths.length > 0 && (
              <GeneratedFilesPanel paths={generatedDocxPaths} workspacePath={displayWorkspace} />
            )}
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
