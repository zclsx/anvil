import { FolderOpen, Plus } from 'lucide-react'
import type { SessionMeta } from '../../../electron/shared/session'
import { WorkspaceBar } from './WorkspaceBar'
import { FileReferenceChips } from './FileReferenceChips'
import { QueuedPromptPill } from './QueuedPromptPill'

type FileReference = {
  path: string
  promptPath: string
  label: string
  isImage: boolean
  isOutsideWorkspace: boolean
}

export function PromptInput({
  prompt,
  trimmedPrompt,
  promptInputRef,
  isFileDragActive,
  running,
  hasRunnableWorkspace,
  canChooseWorkspace,
  canSendPrompt,
  isDraftWorkspace,
  displayWorkspace,
  activeSession,
  pendingWorkspace,
  fileReferences,
  showFileReferencePaths,
  hasFileReferencesWithoutPrompt,
  queuedPrompt,
  queuedFileReferencesCount,
  autoFollow,
  onPromptChange,
  onPromptKeyDown,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemoveFileReference,
  onToggleFileReferencePaths,
  onEditQueued,
  onClearQueued,
  onAutoFollowChange,
  onNew,
  onChangeDraftWorkspace,
  onSend,
  onEnqueueNext,
  onCancel,
}: {
  prompt: string
  trimmedPrompt: string
  promptInputRef: React.RefObject<HTMLTextAreaElement | null>
  isFileDragActive: boolean
  running: boolean
  hasRunnableWorkspace: boolean
  canChooseWorkspace: boolean
  canSendPrompt: boolean
  isDraftWorkspace: boolean
  displayWorkspace: string
  activeSession: SessionMeta | null
  pendingWorkspace: string | null
  fileReferences: FileReference[]
  showFileReferencePaths: boolean
  hasFileReferencesWithoutPrompt: boolean
  queuedPrompt: string | null
  queuedFileReferencesCount: number
  autoFollow: boolean
  onPromptChange: (value: string) => void
  onPromptKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onRemoveFileReference: (path: string) => void
  onToggleFileReferencePaths: () => void
  onEditQueued: () => void
  onClearQueued: () => void
  onAutoFollowChange: (value: boolean) => void
  onNew: () => void
  onChangeDraftWorkspace: () => void
  onSend: () => void
  onEnqueueNext: () => void
  onCancel: () => void
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`p-4 border-t bg-surface-container-lowest flex flex-col gap-2 shrink-0 transition-colors ${
        isFileDragActive ? 'border-drag-border bg-drag-bg' : 'border-outline-variant'
      }`}
    >
      <WorkspaceBar
        displayWorkspace={displayWorkspace}
        activeSession={activeSession}
        pendingWorkspace={pendingWorkspace}
        isDraftWorkspace={isDraftWorkspace}
        running={running}
        onChangeDraftWorkspace={onChangeDraftWorkspace}
      />
      {isFileDragActive && (
        <div className="border border-info-border bg-info-bg px-3 py-2 text-[11px] font-mono-code text-info-text-accent">
          {running ? '松开后添加到草稿引用（不会自动发送）' : '松开后添加文件引用'}
        </div>
      )}
      <FileReferenceChips
        references={fileReferences}
        showPaths={showFileReferencePaths}
        hasFileReferencesWithoutPrompt={hasFileReferencesWithoutPrompt}
        onTogglePaths={onToggleFileReferencePaths}
        onRemove={onRemoveFileReference}
      />
      {queuedPrompt && (
        <QueuedPromptPill
          prompt={queuedPrompt}
          fileReferencesCount={queuedFileReferencesCount}
          onEdit={onEditQueued}
          onClear={onClearQueued}
        />
      )}
      <textarea
        ref={promptInputRef}
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        onKeyDown={onPromptKeyDown}
        className="w-full bg-background border border-outline-variant text-on-surface text-[12px] p-2 focus:border-primary focus:outline-none resize-none font-mono-code leading-normal"
        rows={3}
        placeholder={
          running
            ? queuedPrompt
              ? '输入并回车将替换已排队消息...'
              : '运行中，输入并回车将在当前任务结束后自动发送...'
            : hasRunnableWorkspace
              ? '输入指令...'
              : '先点 New 选择 workspace 目录...'
        }
      />
      <div className="flex justify-between items-center gap-2">
        <label className="flex items-center gap-1.5 font-mono-label text-[10px] text-on-surface-variant cursor-pointer">
          <input
            type="checkbox"
            checked={autoFollow}
            onChange={(e) => onAutoFollowChange(e.target.checked)}
          />
          auto-follow
        </label>
        <div className="flex gap-2">
          <button
            onClick={isDraftWorkspace ? onChangeDraftWorkspace : onNew}
            disabled={!canChooseWorkspace}
            className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text disabled:cursor-not-allowed border border-outline-variant text-on-surface text-[11px] font-mono-label transition-colors cursor-pointer flex items-center gap-1"
          >
            {isDraftWorkspace ? (
              <>
                <FolderOpen size={11} /> 更改目录
              </>
            ) : (
              <>
                <Plus size={11} /> New
              </>
            )}
          </button>
          {running ? (
            <>
              {trimmedPrompt.length > 0 && (
                <button
                  onClick={onEnqueueNext}
                  className="px-3 py-1.5 bg-info-bg hover:bg-info-hover border border-info-border text-info-text-accent text-[11px] font-mono-label transition-colors cursor-pointer flex items-center gap-1"
                >
                  {queuedPrompt ? 'Replace queue' : 'Queue next'}
                </button>
              )}
              <button
                onClick={onCancel}
                className="px-4 py-1.5 bg-status-error-bg hover:bg-status-error-hover text-status-error-text border border-status-error-border font-semibold text-[11px] transition-colors cursor-pointer"
              >
                取消
              </button>
            </>
          ) : (
            <button
              onClick={onSend}
              disabled={!canSendPrompt}
              className="px-4 py-1.5 bg-btn-primary-bg hover:bg-btn-primary-hover disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text disabled:cursor-not-allowed text-btn-primary-text font-semibold text-[11px] transition-colors cursor-pointer"
            >
              发送
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
