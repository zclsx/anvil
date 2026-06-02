import { FileText } from 'lucide-react'
import { RoleIconTile, RoleLabel } from '../RoleIconTile'
import { GeneratedFileChip } from './GeneratedFileChip'

export function GeneratedFilesPanel({
  paths,
  workspacePath,
}: {
  paths: string[]
  workspacePath?: string
}) {
  if (paths.length === 0) return null

  return (
    <div
      data-testid="generated-files-panel"
      className="border border-info-border bg-info-bg/50 px-3 py-3"
    >
      <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
        <RoleIconTile icon={FileText} tone="file" />
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <RoleLabel tone="file">
              生成文件
            </RoleLabel>
            <span className="font-mono-label text-[9px] uppercase tracking-wider text-info-text-secondary">
              {paths.length} 个结果
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {paths.map((path) => (
              <GeneratedFileChip key={path} absPath={path} workspacePath={workspacePath} compact />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
