import type { PublicSettings } from '../../electron/shared/settings'
import type { UpdateSnapshot } from '../../electron/shared/updates'
import { Cpu, Folder, Moon, Settings, Sun } from 'lucide-react'
import { LogoIcon } from './LogoIcon'
import { StatusDot } from './StatusDot'
import { UpdateActionButton } from './UpdateActionButton'
import { truncatePath } from '../lib/pathUtils'

export function Header({
  settings,
  displayWorkspace,
  isDraftWorkspace,
  hasAnvil,
  updateSnapshot,
  theme,
  platform,
  onCheckUpdate,
  onDownloadUpdate,
  onInstallUpdate,
  onToggleSettings,
  onToggleTheme,
}: {
  settings: PublicSettings | null
  displayWorkspace: string
  isDraftWorkspace: boolean
  hasAnvil: boolean
  updateSnapshot: UpdateSnapshot | null
  theme: 'light' | 'dark'
  platform?: string
  onCheckUpdate: () => void
  onDownloadUpdate: () => void
  onInstallUpdate: () => void
  onToggleSettings: () => void
  onToggleTheme: () => void
}) {
  const headerPaddingClass =
    platform === 'darwin' ? 'pl-[80px] pr-3' : platform === 'win32' ? 'pl-3 pr-[140px]' : 'px-3'

  return (
    <header className={`glass-panel flex h-12 w-full shrink-0 items-center border-b text-primary app-header relative z-10 ${headerPaddingClass}`}>

      <div className="no-drag mr-5 flex items-center gap-2.5">
        <LogoIcon className="h-[22px] w-[22px] shrink-0 text-primary" />
        <div className="flex items-baseline gap-2">
          <span className="font-headline text-[15px] font-semibold tracking-tight text-primary">Anvil</span>
          <span className="font-mono-label text-[9px] uppercase tracking-wider text-on-surface-variant">
            工作台
          </span>
        </div>
      </div>
      <div className="flex-grow" />
      <div className="no-drag flex items-center gap-1.5">
        {(settings || displayWorkspace) && (
          <span className="inline-flex max-w-[280px] items-center gap-1.5 border border-glass-border bg-glass-surface-muted px-2 py-1 text-[10px] text-on-surface-variant">
            <Folder size={11} className="shrink-0 text-primary" />
            <span className="font-mono-label uppercase tracking-wider">
              {isDraftWorkspace ? '草稿' : '工作区'}
            </span>
            <span className="min-w-0 truncate font-mono-code">
              {displayWorkspace ? truncatePath(displayWorkspace) : '未选择'}
            </span>
          </span>
        )}
        {settings && (
          <span className="inline-flex max-w-[180px] items-center gap-1.5 border border-glass-border bg-glass-surface-muted px-2 py-1 text-[10px] text-on-surface-variant">
            <Cpu size={11} className="shrink-0 text-primary" />
            <span className="truncate font-mono-code">{settings.model}</span>
          </span>
        )}
        <StatusDot tone={hasAnvil ? 'success' : 'danger'} label={hasAnvil ? '已连接' : '未连接'} />
        {updateSnapshot?.enabled && (
          <UpdateActionButton
            snapshot={updateSnapshot}
            onCheck={onCheckUpdate}
            onDownload={onDownloadUpdate}
            onInstall={onInstallUpdate}
          />
        )}
        <button
          onClick={onToggleTheme}
          className="flex cursor-pointer items-center gap-1.5 border border-glass-border bg-glass-surface-muted px-2 py-1 font-mono-label text-[10px] text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
        >
          {theme === 'dark' ? <Sun size={11} /> : <Moon size={11} />}
          {theme === 'dark' ? '浅色' : '深色'}
        </button>
        <button
          onClick={onToggleSettings}
          className="flex cursor-pointer items-center gap-1.5 border border-glass-border bg-glass-surface-muted px-2 py-1 font-mono-label text-[10px] text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
        >
          <Settings size={11} />
          设置
        </button>
      </div>
    </header>
  )
}
