import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import type { GeneratedDocxArtifact } from '../../lib/generatedFiles'
import { SPINNER_FRAMES } from '../../lib/spinner'
import { RoleIconTile, RoleLabel } from '../RoleIconTile'
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
      className="flex min-w-0 items-center gap-2 border border-status-running-border bg-status-running-bg/75 px-2.5 py-2 text-[11px] text-status-running-text"
    >
      <span aria-hidden="true" className="inline-block w-4 font-mono-code text-[14px]">
        {SPINNER_FRAMES[frame]}
      </span>
      <span className="min-w-0 truncate">
        正在生成 Word 文档{name !== 'Word 文档' ? `：${name}` : ''}…
      </span>
    </div>
  )
}

function FailedGeneratedFileRow({ name, error }: { name: string; error: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border border-status-error-border bg-status-error-bg px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot tone="danger" />
        <span className="min-w-0 truncate text-[11px] font-medium text-status-error-text">
          生成 Word 文档失败{name !== 'Word 文档' ? `：${name}` : ''}
        </span>
      </div>
      <div className="truncate pl-3 text-[10px] text-status-error-text/80">
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
      className="border border-artifact-border bg-artifact-surface px-3 py-3 backdrop-blur-md"
    >
      <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
        <RoleIconTile icon={FileText} tone="file" />
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <RoleLabel tone="file">
              生成文件
            </RoleLabel>
            <span className="font-mono-label text-[9px] uppercase tracking-wider text-info-text-secondary">
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
