import { UserRound } from 'lucide-react'
import { RoleIconTile, RoleLabel } from '../RoleIconTile'

export function UserEchoCard({ prompt }: { prompt: string }) {
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 text-on-surface relative z-10 group">
      <RoleIconTile icon={UserRound} tone="user" size="lg" shape="circle" elevated />
      <div className="flex-grow pt-1 min-w-0">
        <div className="glass-card p-4 rounded-lg rounded-tl-none border border-outline-variant hover:border-primary/30 transition-colors min-w-0">
          <div className="mb-2">
            <RoleLabel tone="user" className="text-label-mono font-label-mono">
              用户输入
            </RoleLabel>
          </div>
          <div className="text-body-md font-body-md text-on-surface whitespace-pre-wrap break-words leading-relaxed">
            {prompt}
          </div>
        </div>
      </div>
    </div>
  )
}
