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

  const actionClass =
    'rounded-[var(--radius-control)] border border-info-border bg-surface px-2 py-1 text-[10px] font-mono-label text-info-text-accent transition-colors hover:border-primary hover:text-primary focus-ring cursor-pointer'

  return (
    <div
      onClick={stop}
      className={`${compact ? '' : 'mt-2'} inline-flex max-w-full flex-col overflow-hidden rounded-[var(--radius-panel)] border border-info-border bg-info-bg text-info-text transition-colors hover:bg-info-hover/60`}
    >
      <div className="flex min-w-0 items-center gap-3 px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-info-border bg-surface text-info-text-accent">
          <FileText size={16} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-2">
          <span className="font-mono-code max-w-[240px] truncate text-[12px] font-medium text-info-text">
            {fileName}
          </span>
          <span className="font-mono-label text-[9px] uppercase tracking-wider text-info-text-secondary">
            DOCX · 已生成
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {rightPanel && (
            <button
              onClick={handlePreview}
              className={actionClass}
              title="预览文档"
            >
              预览
            </button>
          )}
          <button
            onClick={handleOpen}
            className={actionClass}
            title="打开文档"
          >
            打开
          </button>
          <button
            onClick={handleReveal}
            className={actionClass}
            title="在文件夹中定位"
          >
            定位
          </button>
          <button
            onClick={handleCopy}
            className={actionClass}
            title="复制路径"
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
            className="rounded-[var(--radius-control)] border border-transparent px-1.5 py-1 text-on-surface-variant transition-colors hover:border-info-border hover:text-primary focus-ring cursor-pointer"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="flex max-w-full flex-col gap-1.5 border-t border-info-border bg-accent-muted/40 px-3 py-3 font-mono-code text-[11px] text-on-surface-variant break-all">
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
