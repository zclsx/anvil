import { Shield } from 'lucide-react'
import type { PendingApproval } from '../../store'
import { ApprovalCard } from './ApprovalCard'

export function ApprovalsPanel({
  approvals,
  onDecide,
}: {
  approvals: PendingApproval[]
  onDecide: (id: string, decision: 'allow' | 'deny') => void
}) {
  if (approvals.length === 0) return null

  return (
    <div className="border-t border-[#f59e0b] bg-[#2a1f0f] p-3 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <Shield size={14} className="text-[#f59e0b]" />
        <span className="font-mono-label text-[10px] text-[#f59e0b] uppercase tracking-wider">
          Awaiting Approval ({approvals.length})
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {approvals.map((p) => (
          <ApprovalCard key={p.approvalId} approval={p} onDecide={onDecide} />
        ))}
      </div>
    </div>
  )
}
