export function UserEchoCard({ prompt }: { prompt: string }) {
  return (
    <div className="font-mono-code text-[13px] text-on-surface flex gap-2 py-1 px-1 leading-relaxed">
      <span className="text-status-success shrink-0">&gt;</span>
      <span className="whitespace-pre-wrap break-words flex-1">{prompt}</span>
    </div>
  )
}
