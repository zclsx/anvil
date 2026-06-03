export function NoticeBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="glass-panel bg-info-bg/80 border-b border-info-border px-4 py-2 flex items-center gap-3 no-drag shrink-0"
    >
      <div className="flex-1 text-info-text-accent text-[12px] font-body-sm truncate">{message}</div>
      <button
        onClick={onDismiss}
        aria-label="关闭提示"
        className="text-info-text-accent hover:text-primary text-[12px] px-2 cursor-pointer"
      >
        ✕
      </button>
    </div>
  )
}
