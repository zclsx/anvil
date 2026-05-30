export function QueuedPromptPill({
  prompt,
  fileReferencesCount,
  onEdit,
  onClear,
}: {
  prompt: string
  fileReferencesCount: number
  onEdit: () => void
  onClear: () => void
}) {
  return (
    <div className="border border-info-border bg-info-bg px-3 py-2 flex items-center gap-2">
      <span className="font-mono-label text-[10px] text-info-text uppercase tracking-wider shrink-0">
        📩 Queued next
      </span>
      <div className="flex-1 text-[12px] text-on-surface truncate font-mono-code">{prompt}</div>
      {fileReferencesCount > 0 && (
        <span className="font-mono-label text-[10px] text-info-text-accent shrink-0">
          +{fileReferencesCount} refs
        </span>
      )}
      <button
        onClick={onEdit}
        className="text-[10px] font-mono-label text-on-surface-variant hover:text-primary cursor-pointer px-2"
      >
        编辑
      </button>
      <button
        onClick={onClear}
        className="text-[10px] font-mono-label text-status-error-text hover:text-primary cursor-pointer px-2"
        aria-label="取消排队消息"
      >
        ✕
      </button>
    </div>
  )
}
