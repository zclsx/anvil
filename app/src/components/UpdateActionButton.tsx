import type { UpdateSnapshot } from '../../electron/shared/updates'

export function UpdateActionButton({
  snapshot,
  onCheck,
  onDownload,
  onInstall,
}: {
  snapshot: UpdateSnapshot
  onCheck: () => void
  onDownload: () => void
  onInstall: () => void
}) {
  const version = snapshot.version ? ` ${snapshot.version}` : ''
  const percent = snapshot.percent == null ? 0 : Math.floor(snapshot.percent)
  const disabled = snapshot.status === 'checking' || snapshot.status === 'downloading'

  let label = 'Check updates'
  let title = snapshot.message || `Current version ${snapshot.currentVersion}`
  let action = onCheck
  let className = 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'

  if (snapshot.status === 'checking') {
    label = 'Checking...'
  } else if (snapshot.status === 'available') {
    label = `Download${version}`
    action = onDownload
    className = 'border-[#4a9eff]/50 text-[#a0c4ff] hover:bg-[#1f2a3a]'
  } else if (snapshot.status === 'downloading') {
    label = `Downloading ${percent}%`
  } else if (snapshot.status === 'downloaded') {
    label = 'Restart to update'
    action = onInstall
    className = 'border-[#6fbf6f]/50 text-[#9ce29c] hover:bg-[#1f3a1f]'
  } else if (snapshot.status === 'not-available') {
    label = 'Up to date'
  } else if (snapshot.status === 'error') {
    label = 'Update error'
    title = snapshot.message || 'Update check failed'
    className = 'border-[#ff8080]/50 text-[#ffb4ab] hover:bg-[#3a1f1f]'
  }

  return (
    <button
      onClick={action}
      disabled={disabled}
      title={title}
      className={`px-2 py-0.5 text-[10px] font-mono-label bg-surface-container border disabled:opacity-70 disabled:cursor-wait cursor-pointer ${className}`}
    >
      {label}
    </button>
  )
}
