import type { PendingApproval } from '../../store'

export function ApprovalCard({
  approval,
  onDecide,
}: {
  approval: PendingApproval
  onDecide: (id: string, d: 'allow' | 'deny') => void
}) {
  const riskColor =
    approval.risk === 'high' ? 'text-status-danger' :
    approval.risk === 'medium' ? 'text-status-warning' :
    'text-on-surface-variant'

  return (
    <div className="bg-surface-container border border-outline-variant p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono-label text-[10px] text-on-surface uppercase">{approval.toolName}</span>
        <span className={`font-mono-label text-[9px] uppercase ${riskColor}`}>{approval.risk} risk</span>
      </div>
      <pre className="font-mono-code text-[10px] text-on-surface-variant max-h-32 overflow-auto bg-surface-container-lowest border border-outline-variant p-2 rounded">
        {typeof approval.input === 'string' ? approval.input : JSON.stringify(approval.input, null, 2).slice(0, 400)}
      </pre>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => onDecide(approval.approvalId, 'deny')}
          className="px-3 py-1 bg-status-error-bg hover:bg-status-error-hover text-status-error-text border border-status-error-border text-[10px] font-mono-label cursor-pointer"
        >
          Deny
        </button>
        <button
          onClick={() => onDecide(approval.approvalId, 'allow')}
          className="px-3 py-1 bg-status-success-bg hover:bg-status-success-hover text-status-success-text border border-status-success-border text-[10px] font-mono-label cursor-pointer"
        >
          Allow once
        </button>
      </div>
    </div>
  )
}
