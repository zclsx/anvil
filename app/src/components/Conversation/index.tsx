import { useEffect, useRef, useState } from 'react'
import { FileSearch } from 'lucide-react'
import type { Item, Turn } from '../../store'
import { formatWorkspaceShort } from '../../lib/pathUtils'
import { getGeneratedDocxArtifactsForTurn } from '../../lib/generatedFiles'
import { splitTurnItems } from '../../lib/trace'
import type { ProcessExpandMode } from '../../hooks/useConversationExpand'
import { MainItemView } from './MainItemView'
import { UserEchoCard } from './UserEchoCard'
import { ThinkingIndicator } from './ThinkingIndicator'
import { GeneratedFilesPanel } from './GeneratedFilesPanel'
import { ProcessGroup } from './ProcessGroup'

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
  processExpandMode,
  onToggleProcessExpand,
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
  processExpandMode: ProcessExpandMode
  onToggleProcessExpand: () => void
}) {
  const [processOverrides, setProcessOverrides] = useState<Record<string, boolean>>({})
  const prevProcessExpandMode = useRef(processExpandMode)

  useEffect(() => {
    if (prevProcessExpandMode.current !== processExpandMode) {
      prevProcessExpandMode.current = processExpandMode
      setProcessOverrides({})
    }
  }, [processExpandMode])

  function isProcessExpanded(turn: Turn) {
    const override = processOverrides[turn.id]
    if (override !== undefined) return override
    if (processExpandMode === 'expanded') return true
    if (processExpandMode === 'collapsed') return false
    return turn.status === 'running'
  }

  function toggleTurnProcess(turn: Turn) {
    const expanded = isProcessExpanded(turn)
    setProcessOverrides((current) => ({ ...current, [turn.id]: !expanded }))
  }

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
        <div className="sticky top-0 z-10 flex justify-end pointer-events-none -mt-2">
          <button
            onClick={onToggleProcessExpand}
            className="glass-card pointer-events-auto font-mono-label text-[10px] text-on-surface-variant hover:text-primary border px-2 py-0.5 cursor-pointer"
          >
            {processExpandMode === 'expanded' ? '收起过程' : '展开过程'} <span className="opacity-50">⌘E</span>
          </button>
        </div>
      )}
      {turns.map((turn) => {
        if (turn.status === 'running' && turn.itemIds.length === 0) return null
        const generatedDocxArtifacts = getGeneratedDocxArtifactsForTurn(turn, items)
        const { userItems, processItems, finalAnswer } = splitTurnItems(turn, items)
        const processExpanded = isProcessExpanded(turn)
        return (
          <div key={turn.id} className="trace-turn flex flex-col gap-2.5">
            {userItems.map((item) => (
              <MainItemView
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                onSelect={() => onSelectItem(item.id)}
                textVariant="process"
              />
            ))}
            <ProcessGroup
              items={processItems}
              isRunning={turn.status === 'running'}
              isExpanded={processExpanded}
              selectedItemId={selectedItemId}
              onToggle={() => toggleTurnProcess(turn)}
              onSelectItem={onSelectItem}
            />
            {finalAnswer && (
              <MainItemView
                item={finalAnswer}
                isSelected={selectedItemId === finalAnswer.id}
                onSelect={() => onSelectItem(finalAnswer.id)}
                textVariant="final"
              />
            )}
            {generatedDocxArtifacts.length > 0 && (
              <GeneratedFilesPanel artifacts={generatedDocxArtifacts} workspacePath={displayWorkspace} />
            )}
            {turn.status !== 'running' && turn.stats && (
              <div className="text-[10px] font-mono-label text-on-surface-variant flex gap-3 px-1">
                <span className={
                  turn.status === 'failed' ? 'text-status-danger' : 'text-status-success'
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
