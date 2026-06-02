import { UserRound } from 'lucide-react'
import { RoleIconTile, RoleLabel } from '../RoleIconTile'

export function UserEchoCard({ prompt }: { prompt: string }) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 px-1 py-1 text-on-surface">
      <RoleIconTile icon={UserRound} tone="user" />
      <div className="min-w-0">
        <div className="mb-1.5">
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
