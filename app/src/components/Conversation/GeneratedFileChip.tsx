import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Folder, Copy, Eye } from 'lucide-react'
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
    'flex items-center gap-1 text-on-surface-variant hover:text-primary text-label-mono font-label-mono text-xs transition-colors cursor-pointer bg-transparent border-none p-0 focus-ring'

  return (
    <div
      onClick={stop}
      className={`w-full flex flex-col overflow-hidden rounded border border-glass-border bg-surface-container-lowest/40 hover:bg-surface-container-high/40 transition-colors group/file ${
        compact ? '' : 'mt-2'
      }`}
    >
      <div className="flex min-w-0 items-center p-3">
        {/* W Logo */}
        <div className="w-10 h-10 rounded bg-[#185abd]/10 flex items-center justify-center mr-3 border border-[#185abd]/25 text-[#185abd] font-bold text-lg font-headline flex-shrink-0">
          W
        </div>

        {/* Info */}
        <div className="flex-grow min-w-0">
          <div className="text-body-md font-body-md text-on-surface truncate font-medium">
            {fileName}
          </div>
          <div className="text-label-mono font-label-mono text-on-surface-variant/70 text-xs mt-0.5">
            DOCX · 已生成
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 ml-4 pl-4 border-l border-glass-border items-center shrink-0">
          {rightPanel && (
            <button
              onClick={handlePreview}
              className={actionClass}
              title="预览文档"
            >
              <Eye size={12} />
              <span>预览</span>
            </button>
          )}
          <button
            onClick={handleOpen}
            className={actionClass}
            title="打开文档"
          >
            <ExternalLink size={12} />
            <span>打开</span>
          </button>
          <button
            onClick={handleReveal}
            className={actionClass}
            title="在文件夹中定位"
          >
            <Folder size={12} />
            <span>定位</span>
          </button>
          <button
            onClick={handleCopy}
            className={actionClass}
            title="复制路径"
          >
            <Copy size={12} />
            <span>复制</span>
          </button>
          <button
            onClick={(e) => {
              stop(e)
              setExpanded((v) => !v)
            }}
            aria-expanded={expanded}
            aria-label={expanded ? '收起路径' : '展开路径'}
            className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer p-0.5 focus-ring"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex max-w-full flex-col gap-1.5 border-t border-glass-border bg-surface-container-low/30 px-3 py-3 font-mono-code text-[11px] text-on-surface-variant break-all">
          {relPath && (
            <div>
              <span className="text-on-surface-variant/70">Workspace 路径：</span>
              {relPath}
            </div>
          )}
          <div>
            <span className="text-on-surface-variant/70">完整路径：</span>
            {absPath}
          </div>
        </div>
      )}
    </div>
  )
}
