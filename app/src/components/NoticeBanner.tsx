export function NoticeBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="bg-[#1f2a3a] border-b border-[#2f4a5a] px-4 py-2 flex items-center gap-3 no-drag shrink-0"
    >
      <div className="flex-1 text-[#a0c4ff] text-[12px] font-body-sm truncate">{message}</div>
      <button
        onClick={onDismiss}
        aria-label="关闭提示"
        className="text-[#a0c4ff] hover:text-[#ffffff] text-[12px] px-2 cursor-pointer"
      >
        ✕
      </button>
    </div>
  )
}
