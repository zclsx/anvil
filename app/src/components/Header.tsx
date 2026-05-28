import type { PublicSettings } from '../../electron/shared/settings'
import type { UpdateSnapshot } from '../../electron/shared/updates'
import { LogoIcon } from './LogoIcon'
import { UpdateActionButton } from './UpdateActionButton'
import { truncatePath } from '../lib/pathUtils'

export function Header({
  settings,
  displayWorkspace,
  isDraftWorkspace,
  hasAnvil,
  updateSnapshot,
  onCheckUpdate,
  onDownloadUpdate,
  onInstallUpdate,
  onToggleSettings,
}: {
  settings: PublicSettings | null
  displayWorkspace: string
  isDraftWorkspace: boolean
  hasAnvil: boolean
  updateSnapshot: UpdateSnapshot | null
  onCheckUpdate: () => void
  onDownloadUpdate: () => void
  onInstallUpdate: () => void
  onToggleSettings: () => void
}) {
  return (
    <header className="flex items-center pl-[80px] pr-4 w-full bg-surface text-primary border-b border-outline-variant h-12 app-header shrink-0 z-10 relative">
      <div className="flex items-center gap-2 mr-6 no-drag">
        <LogoIcon className="h-[22px] w-[22px] shrink-0" />
        <span className="font-headline text-[16px] text-primary tracking-tight font-semibold">Anvil</span>
        <span className="text-outline-variant text-[14px]">/</span>
        <span className="text-on-surface-variant font-semibold text-[12px]">Workbench</span>
      </div>
      <div className="flex-grow" />
      <div className="flex items-center gap-2 no-drag">
        {(settings || displayWorkspace) && (
          <span className="bg-[#1c1b1d] border border-outline-variant text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-mono-code">
            {displayWorkspace ? `📁 ${truncatePath(displayWorkspace)}${isDraftWorkspace ? ' (draft)' : ''}` : 'no workspace'}
          </span>
        )}
        {settings && (
          <span className="bg-[#1c1b1d] border border-outline-variant text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-mono-code">
            {settings.model}
          </span>
        )}
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
          hasAnvil ? 'bg-[#1f3a1f] text-[#6fbf6f]' : 'bg-[#3a1f1f] text-[#ff8080]'
        }`}>
          {hasAnvil ? 'connected' : 'disconnected'}
        </span>
        {updateSnapshot?.enabled && (
          <UpdateActionButton
            snapshot={updateSnapshot}
            onCheck={onCheckUpdate}
            onDownload={onDownloadUpdate}
            onInstall={onInstallUpdate}
          />
        )}
        <button
          onClick={onToggleSettings}
          className="px-2 py-0.5 text-[10px] font-mono-label bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface-variant cursor-pointer"
        >
          ⚙ Settings
        </button>
      </div>
    </header>
  )
}
