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
      <div className="mb-2 flex items-center justify-between">
        <span className="font-label-caps text-[10px] uppercase tracking-wider text-info-text-accent">
          生成文件
        </span>
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
  )
}
