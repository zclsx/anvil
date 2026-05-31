import { useEffect, useRef, useState } from 'react'
import { ChevronRight, ExternalLink } from 'lucide-react'
import type { Item } from '../../store'
import { toolStepSummary, fullToolOutputText } from '../../lib/toolStep'
import { getGeneratedDocxPath } from '../../lib/generatedFiles'
import { GeneratedFileChip } from './GeneratedFileChip'

const MAX_OUTPUT_CHARS = 8000

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
    <div className="border border-outline-variant bg-surface-container-low">
      <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-container text-[11px] font-mono-label">
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
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary"
        >
          <ChevronRight
            size={12}
            className={`shrink-0 text-on-surface-variant transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          <span className="text-status-warning shrink-0">🔧 {summary.label}</span>
          {summary.risk && (
            <span
              className={`text-[9px] uppercase shrink-0 ${
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
          {summary.approvalLabel && (
            <span
              className={`text-[9px] shrink-0 ${
                summary.approvalLabel.startsWith('✕')
                  ? 'text-status-danger'
                  : summary.approvalLabel.startsWith('✓')
                    ? 'text-status-success'
                    : 'text-status-warning'
              }`}
            >
              {summary.approvalLabel}
            </span>
          )}
          {running && <span className="text-[9px] text-status-running shrink-0">running</span>}
          {summary.isError && <span className="text-[9px] text-status-danger shrink-0">error</span>}
          {summary.argPreview && (
            <span className="font-mono-code text-on-surface-variant truncate">{summary.argPreview}</span>
          )}
          {!expanded && summary.resultPreview && (
            <span className="ml-auto font-mono-code text-on-surface-variant/70 truncate max-w-[200px]">
              ⎿ {summary.resultPreview}
              {summary.extraLines > 0 ? ` +${summary.extraLines}行` : ''}
            </span>
          )}
        </div>
        <button
          onClick={onSelect}
          aria-label="在面板中查看"
          className="shrink-0 text-on-surface-variant hover:text-primary"
        >
          <ExternalLink size={11} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-outline-variant px-3 py-2 flex flex-col gap-2 font-mono-code text-[11px]">
          <div>
            <div className="text-[9px] uppercase text-on-surface-variant mb-1">input</div>
            <pre className="whitespace-pre-wrap break-all text-on-surface-variant max-h-60 overflow-auto">
              {inputText}
            </pre>
          </div>
          {(outputText || running) && (
            <div>
              <div className="text-[9px] uppercase text-on-surface-variant mb-1">
                output{summary.isError ? ' (error)' : ''}
              </div>
              <pre
                className={`whitespace-pre-wrap break-all max-h-80 overflow-auto ${
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
        <div className="px-3 pb-2">
          <GeneratedFileChip absPath={generatedDocxPath} workspacePath={workspacePath} compact />
        </div>
      )}
    </div>
  )
}
