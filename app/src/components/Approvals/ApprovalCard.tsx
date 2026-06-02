import type { PendingApproval } from '../../store'
import { KeyRound, TriangleAlert, X } from 'lucide-react'
import { RoleIconTile, RoleLabel, type RoleTone } from '../RoleIconTile'

function riskLabel(risk: PendingApproval['risk']): string {
  if (risk === 'high') return '高 (high)'
  if (risk === 'medium') return '中 (medium)'
  return '低 (low)'
}

function riskClasses(risk: PendingApproval['risk']): {
  border: string
  strip: string
  text: string
  accent: string
  alert: string
} {
  if (risk === 'high') {
    return {
      border: 'border-status-error-border',
      strip: 'bg-status-error-bg border-status-error-border',
      text: 'text-status-error-text',
      accent: 'bg-status-error-text',
      alert: 'bg-status-error-bg/45 border-status-error-border',
    }
  }
  if (risk === 'medium') {
    return {
      border: 'border-status-warning-border',
      strip: 'bg-status-warning-bg border-status-warning-border',
      text: 'text-status-warning-text',
      accent: 'bg-status-warning-text',
      alert: 'bg-status-warning-bg/45 border-status-warning-border',
    }
  }
  return {
    border: 'border-outline-variant',
    strip: 'bg-surface-container-low border-outline-variant',
    text: 'text-on-surface-variant',
    accent: 'bg-outline',
    alert: 'bg-surface-container-low border-outline-variant',
  }
}

function riskRoleTone(risk: PendingApproval['risk']): RoleTone {
  if (risk === 'high') return 'approvalHigh'
  if (risk === 'medium') return 'approvalMedium'
  return 'approvalLow'
}

export function ApprovalCard({
  approval,
  onDecide,
}: {
  approval: PendingApproval
  onDecide: (id: string, d: 'allow' | 'deny') => void
}) {
  const tone = riskClasses(approval.risk)
  const roleTone = riskRoleTone(approval.risk)
  const inputString =
    typeof approval.input === 'string'
      ? approval.input
      : JSON.stringify(approval.input, null, 2)

  return (
    <div className={`relative overflow-hidden border bg-surface ${tone.border}`}>
      <div className={`absolute left-0 top-0 h-full w-1 ${tone.accent}`} aria-hidden="true" />
      <div className={`grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-b px-4 py-3 pl-5 ${tone.strip}`}>
        <RoleIconTile icon={TriangleAlert} tone={roleTone} />
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <RoleLabel tone={roleTone}>
              审批
            </RoleLabel>
            <span className={`font-mono-label text-[9px] uppercase tracking-wider ${tone.text}`}>
              RISK: {riskLabel(approval.risk)}
            </span>
          </div>
          <div className={`mt-1 font-label-caps text-[10px] font-semibold uppercase tracking-wider ${tone.text}`}>
            审批检查点
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4 pl-5">
        <div className={`border px-3 py-2 ${tone.alert}`}>
          <div className="font-mono-label text-[9px] uppercase tracking-wider text-on-surface-variant">
            工具请求
          </div>
          <div className="mt-1 font-mono-code text-[12px] font-semibold text-on-surface">
            {approval.toolName}
          </div>
        </div>

        <div>
          <div className="mb-1.5 font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant">
            参数
          </div>
          <pre className="code-panel max-h-48 overflow-auto p-3 font-mono-code text-[11px] leading-relaxed select-text">
            <code>{inputString}</code>
          </pre>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => onDecide(approval.approvalId, 'deny')}
            className="inline-flex cursor-pointer items-center gap-1.5 border border-status-error-border bg-status-error-bg px-3 py-1.5 font-mono-label text-[10px] text-status-error-text transition-colors hover:bg-status-error-hover focus-ring"
          >
            <X size={12} />
            拒绝
          </button>
          <button
            onClick={() => onDecide(approval.approvalId, 'allow')}
            className="inline-flex cursor-pointer items-center gap-1.5 border border-status-success-border bg-status-success-bg px-3 py-1.5 font-mono-label text-[10px] text-status-success-text transition-colors hover:bg-status-success-hover focus-ring"
          >
            <KeyRound size={12} />
            允许
          </button>
        </div>
      </div>
    </div>
  )
}
