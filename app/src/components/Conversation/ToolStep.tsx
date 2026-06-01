import { useEffect, useRef, useState } from 'react'
import { ChevronRight, ExternalLink, Wrench } from 'lucide-react'
import type { Item } from '../../store'
import { toolStepSummary, fullToolOutputText } from '../../lib/toolStep'
import { getGeneratedDocxPath } from '../../lib/generatedFiles'
import { GeneratedFileChip } from './GeneratedFileChip'
import { StatusDot, type StatusTone } from '../StatusDot'

const MAX_OUTPUT_CHARS = 8000

function getToolState(summary: ReturnType<typeof toolStepSummary>, running: boolean): { tone: StatusTone; label: string } {
  if (summary.isError) return { tone: 'danger', label: '错误' }
  if (summary.approvalLabel?.startsWith('✕')) return { tone: 'danger', label: '已拒绝' }
  if (summary.approvalLabel?.startsWith('⏳')) return { tone: 'warning', label: '待审批' }
  if (running) return { tone: 'running', label: '运行中' }
  if (summary.hasOutput) return { tone: 'success', label: '完成' }
  return { tone: 'idle', label: '待执行' }
}

export function ToolStep({
  item,
  expandAll,
  onSelect,
  workspacePath,
}: {
  item: Item
  expandAll: boolean
  onSelect: () => void
  workspacePath?: string
}) {
  const [override, setOverride] = useState<boolean | null>(null)
  const prevExpandAll = useRef(expandAll)
  useEffect(() => {
    if (prevExpandAll.current !== expandAll) {
      prevExpandAll.current = expandAll
      setOverride(null)
    }
  }, [expandAll])
  const expanded = override !== null ? override : expandAll

  const summary = toolStepSummary(item)
  const running =
    !summary.hasOutput && summary.approvalLabel !== '✕ denied' && summary.approvalLabel !== '⏳ awaiting'
  const state = getToolState(summary, running)
  const generatedDocxPath = getGeneratedDocxPath(item)

  let inputText: string
  try {
    inputText = JSON.stringify(item.toolInput, null, 2)
  } catch {
    inputText = String(item.toolInput)
  }
  const outputText = fullToolOutputText(item.toolOutput)
  const outputClipped = outputText.length > MAX_OUTPUT_CHARS

  return (
    <div className="border border-outline-variant bg-surface-container-lowest transition-colors hover:border-outline">
      <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-mono-label hover:bg-surface-container-low">
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={() => setOverride(!expanded)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOverride(!expanded)
            }
          }}
          className="grid min-w-0 flex-1 cursor-pointer grid-cols-[auto_auto_minmax(120px,0.8fr)_minmax(120px,1fr)_minmax(96px,0.7fr)] items-center gap-2 focus-ring"
        >
          <ChevronRight
            size={12}
            className={`shrink-0 text-on-surface-variant transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          <span className="inline-flex min-w-0 items-center gap-1.5 text-on-surface">
            <Wrench size={11} className="shrink-0 text-status-warning" />
            <span className="truncate font-mono-code text-[11px]">{summary.label}</span>
          </span>
          <span className="min-w-0 inline-flex items-center gap-2">
            <StatusDot tone={state.tone} label={state.label} className="font-mono-label text-[9px] uppercase text-on-surface-variant" />
            {summary.risk && (
              <span
                className={`text-[9px] uppercase ${
                  summary.risk === 'high'
                    ? 'text-status-danger'
                    : summary.risk === 'medium'
                      ? 'text-status-warning'
                      : 'text-on-surface-variant'
                }`}
              >
                {summary.risk}
              </span>
            )}
          </span>
          <span className="min-w-0 truncate font-mono-code text-[10px] text-on-surface-variant">
            {summary.argPreview || '无参数'}
          </span>
          <span className="min-w-0 truncate font-mono-code text-[10px] text-on-surface-variant/70">
            {!expanded && summary.resultPreview ? (
              <>
                ⎿ {summary.resultPreview}
                {summary.extraLines > 0 ? ` +${summary.extraLines}行` : ''}
              </>
            ) : (
              ' '
            )}
          </span>
        </div>
        <button
          onClick={onSelect}
          aria-label="在面板中查看"
          className="shrink-0 text-on-surface-variant transition-colors hover:text-primary focus-ring"
        >
          <ExternalLink size={11} />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-outline-variant bg-surface-container-low px-3 py-2 font-mono-code text-[11px]">
          <div>
            <div className="mb-1 font-label-caps text-[9px] uppercase tracking-wider text-on-surface-variant">input</div>
            <pre className="max-h-60 overflow-auto border border-outline-variant bg-surface-container-lowest p-2 whitespace-pre-wrap break-all text-on-surface-variant">
              {inputText}
            </pre>
          </div>
          {(outputText || running) && (
            <div>
              <div className="mb-1 font-label-caps text-[9px] uppercase tracking-wider text-on-surface-variant">
                output{summary.isError ? ' (error)' : ''}
              </div>
              <pre
                className={`max-h-80 overflow-auto border border-outline-variant bg-surface-container-lowest p-2 whitespace-pre-wrap break-all ${
                  summary.isError ? 'text-status-danger' : 'text-on-surface'
                }`}
              >
                {running ? '…' : outputText.slice(0, MAX_OUTPUT_CHARS)}
                {outputClipped ? '\n…（已截断，点 ↗ 在 inspector 看完整）' : ''}
              </pre>
            </div>
          )}
        </div>
      )}

      {generatedDocxPath && (
        <div className="border-t border-outline-variant bg-surface-container-low px-3 py-2">
          <GeneratedFileChip absPath={generatedDocxPath} workspacePath={workspacePath} compact />
        </div>
      )}
    </div>
  )
}
