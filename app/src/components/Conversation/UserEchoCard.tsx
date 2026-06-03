import { UserRound } from 'lucide-react'

export function UserEchoCard({ prompt }: { prompt: string }) {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 text-on-surface relative z-10 group">
      {/* Avatar Node */}
      <div className="w-12 h-12 rounded-full glass-card flex-shrink-0 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(255,255,255,0.05)] bg-primary/5">
        <UserRound size={18} className="text-primary" />
      </div>
      {/* Content */}
      <div className="flex-grow pt-1 min-w-0">
        <div className="glass-card p-4 rounded-lg rounded-tl-none border border-outline-variant hover:border-primary/30 transition-colors min-w-0">
          <div className="flex justify-between items-center mb-2">
            <div className="text-label-mono font-label-mono text-on-surface-variant">用户输入</div>
            <span className="text-label-mono font-label-mono text-on-surface-variant/50">{timestamp}</span>
          </div>
          <div className="text-body-md font-body-md text-on-surface whitespace-pre-wrap break-words leading-relaxed">
            {prompt}
          </div>
        </div>
      </div>
    </div>
  )
}

