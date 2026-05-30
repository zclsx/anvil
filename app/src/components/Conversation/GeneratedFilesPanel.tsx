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
      className="bg-surface-container-low border border-outline-variant px-3 py-2"
    >
      <div className="font-mono-label text-[9px] text-[#7fb2f0] uppercase tracking-wider mb-2">
        生成文件
      </div>
      <div className="flex flex-col gap-2">
        {paths.map((path) => (
          <GeneratedFileChip key={path} absPath={path} workspacePath={workspacePath} compact />
        ))}
      </div>
    </div>
  )
}
