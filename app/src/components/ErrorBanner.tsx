import { AlertCircle } from 'lucide-react'

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="bg-[#3a1f1f] border-b border-[#5a2f2f] px-4 py-2 flex items-center gap-3 no-drag shrink-0">
      <AlertCircle size={14} className="text-[#ff8080] shrink-0" />
      <div className="flex-1 text-[#ffb4ab] text-[12px] font-body-sm truncate">{message}</div>
      <button
        onClick={onDismiss}
        className="text-[#ff8080] hover:text-[#ffffff] text-[12px] px-2 cursor-pointer"
      >
        ✕
      </button>
    </div>
  )
}
