import type { PublicSettings } from '../../../electron/shared/settings'
import { SettingField } from './SettingField'

export function SettingsDrawer(props: {
  settings: PublicSettings | null
  draftBaseUrl: string
  draftKey: string
  draftModel: string
  draftWorkspacePath: string
  saved: boolean
  onChangeBaseUrl: (v: string) => void
  onChangeKey: (v: string) => void
  onChangeModel: (v: string) => void
  onChangeWorkspace: (v: string) => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <div className="bg-surface-container border-b border-outline-variant px-4 py-3 grid gap-2 shrink-0 no-drag">
      <div className="flex items-center justify-between mb-1">
        <span className="font-headline text-[12px] font-semibold text-primary">Settings</span>
        <button onClick={props.onClose} className="text-on-surface-variant hover:text-primary text-[12px]">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SettingField label="Default Workspace Path" value={props.draftWorkspacePath} placeholder="/path/to/project" onChange={props.onChangeWorkspace} />
        <SettingField label="Base URL" value={props.draftBaseUrl} placeholder="https://..." onChange={props.onChangeBaseUrl} />
        <SettingField
          label="API Key"
          value={props.draftKey}
          type="password"
          placeholder={props.settings?.hasApiKey ? '已配置 (保持不变)' : 'sk-... 或 tp-...'}
          onChange={props.onChangeKey}
        />
        <SettingField label="Model" value={props.draftModel} placeholder="mimo-v2.5-pro" onChange={props.onChangeModel} />
      </div>
      <button onClick={props.onSave} className="self-end px-4 py-1 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-on-surface font-mono-label text-[11px] cursor-pointer">
        {props.saved ? '✅ 已保存' : '保存配置'}
      </button>
    </div>
  )
}
