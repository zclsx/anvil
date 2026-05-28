import type { PendingApproval } from '../../store'

export function ApprovalCard({
  approval,
  onDecide,
}: {
  approval: PendingApproval
  onDecide: (id: string, d: 'allow' | 'deny') => void
}) {
  const riskColor =
    approval.risk === 'high' ? 'text-[#ff8080]' :
    approval.risk === 'medium' ? 'text-[#f59e0b]' :
    'text-on-surface-variant'

  return (
    <div className="bg-surface-container border border-outline-variant p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono-label text-[10px] text-on-surface uppercase">{approval.toolName}</span>
        <span className={`font-mono-label text-[9px] uppercase ${riskColor}`}>{approval.risk} risk</span>
      </div>
      <pre className="font-mono-code text-[10px] text-on-surface-variant max-h-32 overflow-auto bg-[#0d0d0f] p-2 rounded">
        {typeof approval.input === 'string' ? approval.input : JSON.stringify(approval.input, null, 2).slice(0, 400)}
      </pre>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => onDecide(approval.approvalId, 'deny')}
          className="px-3 py-1 bg-[#3a1f1f] hover:bg-[#5a2f2f] text-[#ff8080] text-[10px] font-mono-label cursor-pointer"
        >
          Deny
        </button>
        <button
          onClick={() => onDecide(approval.approvalId, 'allow')}
          className="px-3 py-1 bg-[#1f3a1f] hover:bg-[#2f5a2f] text-[#6fbf6f] text-[10px] font-mono-label cursor-pointer"
        >
          Allow once
        </button>
      </div>
    </div>
  )
}
