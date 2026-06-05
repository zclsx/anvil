import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, Wrench } from 'lucide-react'
import type { Item, PendingApproval, Turn } from '../../store'
import { deriveTaskWorkbenchModel, type TaskWorkbenchTone, type TaskToolRun } from '../../lib/taskWorkbench'
import type { GeneratedDocxArtifact } from '../../lib/generatedFiles'
import { SPINNER_FRAMES } from '../../lib/spinner'
import { GeneratedFileChip } from '../Conversation/GeneratedFileChip'
import { StatusDot, type StatusTone } from '../StatusDot'

const toneIcon = {
  idle: Clock3,
  running: Clock3,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertTriangle,
} satisfies Record<TaskWorkbenchTone, typeof Clock3>

function formatDuration(ms: number | undefined): string | null {
  if (ms == null) return null
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function Section({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-glass-border px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-label-caps text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
          {title}
        </h3>
        {meta && (
          <span className="font-label-mono text-[10px] text-on-surface-variant/60">
            {meta}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-dashed border-outline-variant/60 bg-surface-container-lowest/25 px-3 py-3 text-[11px] text-on-surface-variant">
      {children}
    </div>
  )
}

function PendingArtifactRow({ name }: { name: string }) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((current) => (current + 1) % SPINNER_FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-w-0 items-center gap-2 rounded-[var(--radius-panel)] border border-status-running-border bg-status-running-bg/35 px-3 py-2.5 text-status-running-text"
    >
      <span aria-hidden="true" className="inline-block w-4 font-mono-code text-[13px]">
        {SPINNER_FRAMES[frame]}
      </span>
      <span className="min-w-0 truncate text-[11px]">
        正在生成{name !== 'Word 文档' ? `：${name}` : ' Word 文档'}…
      </span>
    </div>
  )
}

function FailedArtifactRow({ name, error }: { name: string; error: string }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-status-error-border bg-status-error-bg/35 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot tone="danger" />
        <span className="min-w-0 truncate text-[11px] font-medium text-status-error-text">
          生成失败{name !== 'Word 文档' ? `：${name}` : ''}
        </span>
      </div>
      <div className="mt-1 truncate pl-4 font-mono-code text-[10px] text-status-error-text/80">
        {error}
      </div>
    </div>
  )
}

function ArtifactRows({
  artifacts,
  workspacePath,
}: {
  artifacts: GeneratedDocxArtifact[]
  workspacePath?: string
}) {
  if (artifacts.length === 0) {
    return <EmptyLine>当前任务还没有生成文件。</EmptyLine>
  }

  return (
    <div className="flex flex-col gap-2">
      {artifacts.map((artifact) => {
        if (artifact.status === 'success') {
          return (
            <GeneratedFileChip
              key={artifact.path}
              absPath={artifact.path}
              workspacePath={workspacePath}
              compact
            />
          )
        }
        if (artifact.status === 'pending') {
          return <PendingArtifactRow key={artifact.itemId} name={artifact.name} />
        }
        return <FailedArtifactRow key={artifact.itemId} name={artifact.name} error={artifact.error} />
      })}
    </div>
  )
}

function ToolRunRow({
  tool,
  onInspect,
}: {
  tool: TaskToolRun
  onInspect: (itemId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onInspect(tool.itemId)}
      className="group flex w-full cursor-pointer items-start gap-2 rounded-[var(--radius-panel)] border border-glass-border bg-surface-container-lowest/30 px-3 py-2.5 text-left transition-colors hover:border-primary/30 hover:bg-surface-container-high/30 focus-ring"
    >
      <Wrench size={13} className="mt-0.5 shrink-0 text-info-text-accent" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-label-mono text-[11px] text-on-surface">
            {tool.label}
          </span>
          <StatusDot tone={tool.tone as StatusTone} label={tool.statusLabel} className="shrink-0" />
        </div>
        <div className="mt-1 truncate text-[11px] text-on-surface-variant">
          {tool.argPreview || '无参数'}
        </div>
        {tool.resultPreview && (
          <div className="mt-1 truncate font-mono-code text-[10px] text-on-surface-variant/70">
            ⎿ {tool.resultPreview}{tool.extraLines > 0 ? ` +${tool.extraLines} 行` : ''}
          </div>
        )}
      </div>
      <ExternalLink
        size={12}
        className="mt-0.5 shrink-0 text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  )
}

export function TaskWorkbench({
  turns,
  items,
  pendingApprovals,
  workspacePath,
  onInspectItem,
}: {
  turns: Turn[]
  items: Record<string, Item>
  pendingApprovals: PendingApproval[]
  workspacePath?: string
  onInspectItem: (itemId: string) => void
}) {
  const model = useMemo(
    () => deriveTaskWorkbenchModel({ turns, items, pendingApprovals }),
    [items, pendingApprovals, turns],
  )
  const Icon = toneIcon[model.tone]
  const duration = formatDuration(model.activeTurn?.stats?.durationMs)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollable bg-glass-surface-muted/40">
      <div className="px-4 py-4">
        <div className="rounded-[var(--radius-panel)] border border-outline-variant bg-surface-container-lowest/55 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-glass-border bg-surface-container-high/45">
              <Icon size={15} className={
                model.tone === 'danger'
                  ? 'text-status-error-text'
                  : model.tone === 'warning'
                    ? 'text-status-warning-text'
                    : model.tone === 'success'
                      ? 'text-status-success-text'
                      : model.tone === 'running'
                        ? 'text-status-running-text'
                        : 'text-on-surface-variant'
              } />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="font-label-caps text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  当前任务
                </div>
                <StatusDot tone={model.tone as StatusTone} label={model.label} />
              </div>
              <div className="mt-2 text-body-md font-body-md text-on-surface">
                {model.description}
              </div>
              {model.activeTurn?.stats && (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-label-mono text-[10px] text-on-surface-variant/70">
                  {duration && <span>耗时 {duration}</span>}
                  {model.activeTurn.stats.outputTokens != null && <span>{model.activeTurn.stats.outputTokens} out</span>}
                  {model.activeTurn.stats.costUsd != null && <span>${model.activeTurn.stats.costUsd.toFixed(4)}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Section title="工具运行" meta={model.toolRuns.length > 0 ? `${model.toolRuns.length} 项` : undefined}>
        {model.toolRuns.length > 0 ? (
          <div className="flex flex-col gap-2">
            {model.toolRuns.map((tool) => (
              <ToolRunRow key={tool.itemId} tool={tool} onInspect={onInspectItem} />
            ))}
          </div>
        ) : (
          <EmptyLine>当前任务没有工具调用。</EmptyLine>
        )}
      </Section>

      <Section title="生成文件" meta={model.artifacts.length > 0 ? `${model.artifacts.length} 个` : undefined}>
        <ArtifactRows artifacts={model.artifacts} workspacePath={workspacePath} />
      </Section>
    </div>
  )
}
