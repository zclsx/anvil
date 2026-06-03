import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Wrench } from 'lucide-react'
import type { Item } from '../../store'
import { toolStepSummary, fullToolOutputText } from '../../lib/toolStep'

const MAX_OUTPUT_CHARS = 8000

function getToolState(summary: ReturnType<typeof toolStepSummary>, running: boolean): { tone: 'danger' | 'warning' | 'running' | 'success' | 'idle'; label: string } {
  if (summary.isError) return { tone: 'danger', label: '错误' }
  if (summary.approvalLabel?.startsWith('✕')) return { tone: 'danger', label: '已拒绝' }
  if (summary.approvalLabel?.startsWith('⏳')) return { tone: 'warning', label: '待审批' }
  if (running) return { tone: 'running', label: '运行中' }
  if (summary.hasOutput) return { tone: 'success', label: '完成' }
  return { tone: 'idle', label: '待执行' }
}

export function ToolStep({
  item,
  onSelect,
}: {
  item: Item
  onSelect: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const summary = toolStepSummary(item)
  const running =
    !summary.hasOutput && summary.approvalLabel !== '✕ denied' && summary.approvalLabel !== '⏳ awaiting'
  const state = getToolState(summary, running)

  let inputText: string
  try {
    inputText = JSON.stringify(item.toolInput, null, 2)
  } catch {
    inputText = String(item.toolInput)
  }
  const outputText = fullToolOutputText(item.toolOutput)
  const outputClipped = outputText.length > MAX_OUTPUT_CHARS

  const statusColors: Record<typeof state.tone, string> = {
    danger: 'text-status-danger bg-status-danger-chip-bg border-status-danger/30',
    warning: 'text-status-warning bg-status-warning-chip-bg border-status-warning/30',
    running: 'text-status-running-text bg-status-running-bg/30 border-status-running-border/30',
    success: 'text-status-success bg-status-success-chip-bg border-status-success-border/30',
    idle: 'text-on-surface-variant/70 bg-surface-container-high/30 border-border-subtle/30',
  }

  return (
    <div className="w-full border border-glass-border bg-surface-container-lowest/30 hover:bg-surface-container-high/30 rounded transition-colors overflow-hidden flex flex-col group/step">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between p-3 cursor-pointer text-body-md font-body-md"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Wrench size={14} className="shrink-0 text-secondary" />
          <span className="font-label-mono text-label-mono text-on-surface shrink-0">tool_use {summary.label}</span>
          <span className="text-body-md font-body-md text-on-surface-variant ml-4 truncate min-w-0">
            {summary.argPreview || '无参数'}
          </span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold border ${statusColors[state.tone]}`}>
            {state.label}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
            aria-label="在面板中查看"
            className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer p-0.5 focus-ring"
          >
            <ExternalLink size={12} />
          </button>

          <div className="text-on-surface-variant p-0.5">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-glass-border bg-surface-container-low/20 px-4 py-3 font-mono-code text-[11px] w-full">
          <div>
            <div className="mb-1.5 font-label-caps text-[9px] uppercase tracking-wider text-on-surface-variant">input</div>
            <pre className="code-panel max-h-60 overflow-auto p-3 whitespace-pre-wrap break-all w-full leading-relaxed">
              {inputText}
            </pre>
          </div>
          {(outputText || running) && (
            <div>
              <div className="mb-1.5 font-label-caps text-[9px] uppercase tracking-wider text-on-surface-variant">
                output{summary.isError ? ' (error)' : ''}
              </div>
              <pre
                className={`code-panel max-h-80 overflow-auto p-3 whitespace-pre-wrap break-all w-full leading-relaxed ${
                  summary.isError ? 'code-panel-error' : ''
                }`}
              >
                {running ? '…' : outputText.slice(0, MAX_OUTPUT_CHARS)}
                {outputClipped ? '\n…（已截断，点 ↗ 在 inspector 看完整）' : ''}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
