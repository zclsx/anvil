import { UserRound } from 'lucide-react'
import { RoleIconTile, RoleLabel } from '../RoleIconTile'

export function UserEchoCard({ prompt }: { prompt: string }) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 text-on-surface">
      <RoleIconTile icon={UserRound} tone="user" className="mt-0.5" />
      <div className="glass-card min-w-0 border px-3 py-2.5">
        <div className="mb-2">
          <RoleLabel tone="user">
            用户输入
          </RoleLabel>
        </div>
        <div className="font-mono-code text-[13px] leading-relaxed">
          <span className="whitespace-pre-wrap break-words">{prompt}</span>
        </div>
      </div>
    </div>
  )
}
