import type { LucideIcon } from 'lucide-react'

export type RoleTone =
  | 'user'
  | 'process'
  | 'final'
  | 'approvalHigh'
  | 'approvalMedium'
  | 'approvalLow'
  | 'file'

const toneClasses: Record<RoleTone, { tile: string; icon: string; label: string }> = {
  user: {
    tile: 'border-status-success-border bg-status-success-bg/45',
    icon: 'text-status-success-text',
    label: 'text-status-success-text',
  },
  process: {
    tile: 'border-info-border bg-info-bg/35',
    icon: 'text-info-text-accent',
    label: 'text-info-text-accent',
  },
  final: {
    tile: 'border-status-success-border/30 bg-status-success-chip-bg',
    icon: 'text-status-success',
    label: 'text-status-success',
  },
  approvalHigh: {
    tile: 'border-status-error-border bg-status-error-bg/55',
    icon: 'text-status-error-text',
    label: 'text-status-error-text',
  },
  approvalMedium: {
    tile: 'border-status-warning-border bg-status-warning-bg/55',
    icon: 'text-status-warning-text',
    label: 'text-status-warning-text',
  },
  approvalLow: {
    tile: 'border-outline-variant bg-surface-container-low',
    icon: 'text-on-surface-variant',
    label: 'text-on-surface-variant',
  },
  file: {
    tile: 'border-info-border bg-info-bg/55',
    icon: 'text-info-text-accent',
    label: 'text-info-text-accent',
  },
}

type RoleIconTileSize = 'sm' | 'lg'
type RoleIconTileShape = 'square' | 'circle'

export function RoleIconTile({
  icon: Icon,
  tone,
  size = 'sm',
  shape = 'square',
  elevated = false,
  className = '',
}: {
  icon: LucideIcon
  tone: RoleTone
  size?: RoleIconTileSize
  shape?: RoleIconTileShape
  elevated?: boolean
  className?: string
}) {
  const classes = toneClasses[tone]
  const sizeClass = size === 'lg' ? 'h-12 w-12' : 'h-8 w-8'
  const iconSize = size === 'lg' ? 18 : 14
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-[var(--radius-control)]'
  const shadowClass = elevated ? 'shadow-[0_0_15px_var(--color-trace-node-shadow)]' : ''

  return (
    <span
      className={`relative z-[1] flex shrink-0 items-center justify-center border backdrop-blur-sm ${sizeClass} ${shapeClass} ${shadowClass} ${classes.tile} ${className}`}
      aria-hidden="true"
    >
      <Icon size={iconSize} strokeWidth={1.8} className={classes.icon} />
    </span>
  )
}

export function RoleLabel({
  tone,
  children,
  className = '',
}: {
  tone: RoleTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={`font-label-caps text-[10px] uppercase tracking-wider ${toneClasses[tone].label} ${className}`}>
      {children}
    </span>
  )
}
