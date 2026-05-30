import { AlertCircle } from 'lucide-react'

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="bg-status-error-bg border-b border-status-error-border px-4 py-2 flex items-center gap-3 no-drag shrink-0">
      <AlertCircle size={14} className="text-status-error-text shrink-0" />
      <div className="flex-1 text-status-error-text text-[12px] font-body-sm truncate">{message}</div>
      <button
        onClick={onDismiss}
        className="text-status-error-text hover:text-primary text-[12px] px-2 cursor-pointer"
      >
        ✕
      </button>
    </div>
  )
}
