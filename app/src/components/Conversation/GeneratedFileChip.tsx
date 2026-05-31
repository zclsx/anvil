import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { useAgentStore } from '../../store'
import { getWorkspaceRelativePath } from '../../lib/pathUtils'
import { useRightPanel } from '../RightPanel/context'

export function GeneratedFileChip({
  absPath,
  workspacePath,
  compact = false,
}: {
  absPath: string
  workspacePath?: string
  compact?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const pushError = useAgentStore((s) => s.pushError)
  const rightPanel = useRightPanel()

  const fileName = absPath.split(/[\\/]/).filter(Boolean).pop() ?? absPath
  const relPath = workspacePath ? getWorkspaceRelativePath(absPath, workspacePath) : null

  function stop(e: React.MouseEvent) {
    e.stopPropagation()
  }

  async function handleOpen(e: React.MouseEvent) {
    stop(e)
    const result = await window.anvil?.files.openPath(absPath)
    if (result && !result.ok && result.error) pushError(result.error)
  }

  async function handleReveal(e: React.MouseEvent) {
    stop(e)
    const result = await window.anvil?.files.showInFolder(absPath)
    if (result && !result.ok && result.error) pushError(result.error)
  }

  async function handleCopy(e: React.MouseEvent) {
    stop(e)
    try {
      await navigator.clipboard.writeText(absPath)
    } catch {
      pushError('复制路径失败')
    }
  }

  function handlePreview(e: React.MouseEvent) {
    stop(e)
    rightPanel?.openPreview(absPath, fileName)
  }

  return (
    <div
      onClick={stop}
      className={`${compact ? '' : 'mt-2'} border border-info-border bg-info-bg px-3 py-2 flex flex-col gap-2`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <FileText size={13} className="text-info-text-accent shrink-0" />
        <span className="font-mono-label text-[9px] text-info-text-secondary uppercase tracking-wider">DOCX</span>
        <span className="font-mono-code text-[12px] text-info-text truncate max-w-[200px]">{fileName}</span>
        <div className="flex items-center gap-1 ml-auto">
          {rightPanel && (
            <button
              onClick={handlePreview}
              className="text-[10px] font-mono-label text-info-text-accent hover:text-primary cursor-pointer px-2 py-0.5"
            >
              预览
            </button>
          )}
          <button
            onClick={handleOpen}
            className="text-[10px] font-mono-label text-info-text-accent hover:text-primary cursor-pointer px-2 py-0.5"
          >
            打开
          </button>
          <button
            onClick={handleReveal}
            className="text-[10px] font-mono-label text-info-text-accent hover:text-primary cursor-pointer px-2 py-0.5"
          >
            定位
          </button>
          <button
            onClick={handleCopy}
            className="text-[10px] font-mono-label text-on-surface-variant hover:text-primary cursor-pointer px-2 py-0.5"
          >
            复制路径
          </button>
          <button
            onClick={(e) => {
              stop(e)
              setExpanded((v) => !v)
            }}
            aria-expanded={expanded}
            aria-label={expanded ? '收起路径' : '展开路径'}
            className="text-on-surface-variant hover:text-primary cursor-pointer px-1"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-outline-variant pt-2 flex flex-col gap-1 font-mono-code text-[11px] text-on-surface-variant break-all">
          {relPath && (
            <div>
              <span className="text-info-text-secondary">Workspace 路径：</span>
              {relPath}
            </div>
          )}
          <div>
            <span className="text-info-text-secondary">完整路径：</span>
            {absPath}
          </div>
        </div>
      )}
    </div>
  )
}
