import { ChevronDown, ChevronUp, File as FileIcon, Image as ImageIcon, X } from 'lucide-react'
import { getPromptPathDisplay } from '../../lib/pathUtils'

type FileReference = {
  path: string
  promptPath: string
  label: string
  isImage: boolean
  isOutsideWorkspace: boolean
}

export function FileReferenceChips({
  references,
  showPaths,
  hasFileReferencesWithoutPrompt,
  onTogglePaths,
  onRemove,
}: {
  references: FileReference[]
  showPaths: boolean
  hasFileReferencesWithoutPrompt: boolean
  onTogglePaths: () => void
  onRemove: (path: string) => void
}) {
  if (references.length === 0) return null

  return (
    <div className="flex flex-col gap-2 border border-outline-variant bg-surface-container px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
          引用
        </span>
        {references.map((reference) => {
          const Icon = reference.isImage ? ImageIcon : FileIcon
          return (
            <span
              key={reference.path}
              title={reference.path}
              className="inline-flex max-w-full items-center gap-1.5 border border-[#4a9eff]/35 bg-[#1f2a3a] px-2 py-1 text-[11px] text-[#d8e7ff]"
            >
              <Icon size={12} className={reference.isImage ? 'text-[#b7a7ff]' : 'text-[#a0c4ff]'} />
              <span className="font-mono-code truncate max-w-[140px]">{reference.label}</span>
              {reference.isOutsideWorkspace && (
                <span className="font-mono-label text-[9px] text-[#f59e0b]">外部</span>
              )}
              <button
                onClick={() => onRemove(reference.path)}
                className="text-on-surface-variant hover:text-[#ffffff] cursor-pointer"
                aria-label={`移除文件引用 ${reference.label}`}
                title="移除"
              >
                <X size={11} />
              </button>
            </span>
          )
        })}
        <button
          onClick={onTogglePaths}
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono-label text-on-surface-variant hover:text-primary cursor-pointer"
          aria-expanded={showPaths}
          title={showPaths ? '收起完整路径' : '查看完整路径'}
        >
          {showPaths ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          路径
        </button>
      </div>
      {showPaths && (
        <div className="border-t border-outline-variant pt-2 flex flex-col gap-1">
          {references.map((reference, index) => {
            const promptPathDisplay = getPromptPathDisplay(reference.promptPath)
            return (
              <div key={reference.path} className="grid grid-cols-[24px_1fr] gap-2 text-[11px]">
                <span className="font-mono-label text-[#7fb2f0] text-right">{index + 1}</span>
                <div className="font-mono-code text-on-surface-variant break-all">
                  <div>{promptPathDisplay}</div>
                  {reference.path !== promptPathDisplay && (
                    <div className="text-[10px] opacity-70">本地路径：{reference.path}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {hasFileReferencesWithoutPrompt && (
        <div className="border-t border-outline-variant pt-2 text-[11px] font-mono-code text-on-surface-variant">
          请先输入指令，再发送这些文件引用
        </div>
      )}
    </div>
  )
}
