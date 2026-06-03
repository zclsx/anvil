import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import type { GeneratedDocxArtifact } from '../../lib/generatedFiles'
import { SPINNER_FRAMES } from '../../lib/spinner'
import { StatusDot } from '../StatusDot'
import { GeneratedFileChip } from './GeneratedFileChip'

function PendingGeneratedFileRow({ name }: { name: string }) {
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
      className="flex min-w-0 items-center gap-2 border border-status-running-border bg-status-running-bg/40 px-3 py-2.5 rounded text-[11px] text-status-running-text"
    >
      <span aria-hidden="true" className="inline-block w-4 font-mono-code text-[14px]">
        {SPINNER_FRAMES[frame]}
      </span>
      <span className="min-w-0 truncate text-body-md font-body-md">
        正在生成 Word 文档{name !== 'Word 文档' ? `：${name}` : ''}…
      </span>
    </div>
  )
}

function FailedGeneratedFileRow({ name, error }: { name: string; error: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border border-status-error-border bg-status-error-bg/40 px-3 py-2.5 rounded">
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot tone="danger" />
        <span className="min-w-0 truncate text-status-error-text text-body-md font-body-md font-medium">
          生成 Word 文档失败{name !== 'Word 文档' ? `：${name}` : ''}
        </span>
      </div>
      <div className="truncate pl-4 text-[10px] text-status-error-text/80 font-mono-code">
        {error}
      </div>
    </div>
  )
}

export function GeneratedFilesPanel({
  artifacts,
  workspacePath,
}: {
  artifacts: GeneratedDocxArtifact[]
  workspacePath?: string
}) {
  if (artifacts.length === 0) return null

  return (
    <div
      data-testid="generated-files-panel"
      className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 relative z-10 group"
    >
      {/* File Avatar */}
      <div className="w-12 h-12 rounded-full glass-card flex-shrink-0 flex items-center justify-center border border-on-surface/10 bg-surface-container-lowest/50">
        <FileText size={18} className="text-on-surface-variant" />
      </div>
      <div className="flex-grow pt-1 min-w-0">
        <div className="glass-card p-4 rounded-lg rounded-tl-none border border-outline-variant hover:border-primary/30 transition-colors min-w-0">
          <div className="flex justify-between items-center mb-3">
            <div className="text-label-mono font-label-mono text-on-surface-variant">生成文件</div>
            <span className="text-label-mono font-label-mono text-on-surface-variant/50">
              {artifacts.length} 个结果
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {artifacts.map((artifact) => (
              artifact.status === 'success' ? (
                <GeneratedFileChip
                  key={artifact.path}
                  absPath={artifact.path}
                  workspacePath={workspacePath}
                  compact
                />
              ) : artifact.status === 'pending' ? (
                <PendingGeneratedFileRow key={artifact.itemId} name={artifact.name} />
              ) : (
                <FailedGeneratedFileRow key={artifact.itemId} name={artifact.name} error={artifact.error} />
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
