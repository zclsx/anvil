import type { AgentEventEnvelope } from '../../electron/shared/events'

export function DebugPanel({
  rawEvents,
  onClose,
}: {
  rawEvents: AgentEventEnvelope[]
  onClose: () => void
}) {
  return (
    <div className="absolute right-4 bottom-12 w-[320px] max-h-[300px] bg-surface-container-lowest border border-outline-variant p-4 z-50 overflow-y-auto rounded-[var(--radius-panel)]">
      <div className="flex justify-between items-center border-b border-outline-variant pb-2 mb-2">
        <span className="font-mono-label text-[10px] text-primary uppercase">
          Raw Events ({rawEvents.length})
        </span>
        <button onClick={onClose} className="text-on-surface-variant hover:text-primary">
          ✕
        </button>
      </div>
      <pre className="font-mono-code text-[10px] text-outline-variant leading-relaxed">
        {rawEvents.map((e, i) => `${i}: ${e.event.type}\n`).join('') || 'No events.'}
      </pre>
    </div>
  )
}
