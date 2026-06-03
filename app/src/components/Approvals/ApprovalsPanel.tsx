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
    <div className="glass-panel border-t border-status-warning-border bg-status-warning-bg/80 p-3 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <Shield size={14} className="text-status-warning-text" />
        <span className="font-mono-label text-[10px] text-status-warning-text uppercase tracking-wider">
          等待审批 ({approvals.length})
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
