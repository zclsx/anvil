export type StatusTone = 'idle' | 'running' | 'success' | 'warning' | 'danger'

const toneClass: Record<StatusTone, { dot: string; chip: string }> = {
  idle: {
    dot: 'bg-status-idle-text',
    chip: 'border-status-idle-border bg-status-idle-bg text-status-idle-text',
  },
  running: {
    dot: 'bg-status-running-text',
    chip: 'border-status-running-border bg-status-running-bg text-status-running-text',
  },
  success: {
    dot: 'bg-status-success',
    chip: 'border-status-success-border bg-status-success-chip-bg text-status-success-text',
  },
  warning: {
    dot: 'bg-status-warning',
    chip: 'border-status-warning-border bg-status-warning-chip-bg text-status-warning-text',
  },
  danger: {
    dot: 'bg-status-danger',
    chip: 'border-status-error-border bg-status-danger-chip-bg text-status-error-text',
  },
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
  const classes = toneClass[tone]
  if (!label) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${classes.dot}`} aria-hidden="true" />
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-1.5 py-0.5 font-label-caps text-[9px] uppercase tracking-wider ${classes.chip} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${classes.dot}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
