import type { Turn } from '../store'
import { StatusDot } from './StatusDot'

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
    <footer className="glass-panel relative z-10 flex h-8 w-full shrink-0 items-center justify-between border-t px-4 font-mono-code text-[10px] text-on-surface-variant">
      <div className="flex items-center gap-3">
        <StatusDot tone={sessionId ? 'success' : 'idle'} label={sessionId ? '会话在线' : '未选择会话'} />
        <span className="text-outline-variant/70">/</span>
        <span className="uppercase tracking-wider">id {sessionId?.slice(0, 8) || 'none'}</span>
        {lastTurn?.stats && (
          <>
            <span className="text-outline-variant/70">/</span>
            <span className="uppercase tracking-wider">tokens {lastTurn.stats.outputTokens || 0}</span>
            <span className="text-outline-variant/70">/</span>
            <span className="uppercase tracking-wider">
              latency {lastTurn.stats.durationMs ? `${lastTurn.stats.durationMs}ms` : '-'}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onToggleDebug} className="cursor-pointer uppercase tracking-wider hover:text-primary">
          {showDebug ? '隐藏' : '显示'} debug ({rawEventsCount})
        </button>
        <span className="text-outline-variant/70">/</span>
        <span className="uppercase tracking-wider">v0.0.4 dev</span>
      </div>
    </footer>
  )
}
