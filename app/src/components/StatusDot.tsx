export type StatusTone = 'idle' | 'running' | 'success' | 'warning' | 'danger'

const toneClass: Record<StatusTone, string> = {
  idle: 'bg-on-surface-variant',
  running: 'bg-status-running',
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  danger: 'bg-status-danger',
}

export function StatusDot({
  tone,
  label,
  className = '',
}: {
  tone: StatusTone
  label?: string
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${toneClass[tone]}`} aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  )
}
