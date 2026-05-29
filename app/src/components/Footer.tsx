import type { Turn } from '../store'

export function Footer({
  sessionId,
  lastTurn,
  showDebug,
  rawEventsCount,
  onToggleDebug,
}: {
  sessionId: string | null
  lastTurn: Turn | undefined
  showDebug: boolean
  rawEventsCount: number
  onToggleDebug: () => void
}) {
  return (
    <footer className="flex justify-between items-center px-4 w-full bg-surface-container-lowest text-on-surface-variant font-mono-code text-[10px] h-8 border-t border-outline-variant shrink-0 z-10 relative">
      <div className="flex gap-4">
        <span className="uppercase">session: {sessionId?.slice(0, 8) || 'none'}</span>
        {lastTurn?.stats && (
          <>
            <span className="uppercase">tokens: {lastTurn.stats.outputTokens || 0}</span>
            <span className="uppercase">
              latency: {lastTurn.stats.durationMs ? `${lastTurn.stats.durationMs}ms` : '-'}
            </span>
          </>
        )}
      </div>
      <div className="flex gap-4 items-center">
        <button onClick={onToggleDebug} className="hover:text-primary cursor-pointer uppercase">
          {showDebug ? '隐藏' : '显示'} debug ({rawEventsCount})
        </button>
        <span>v0.0.3 · dev</span>
      </div>
    </footer>
  )
}
