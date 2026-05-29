import type { IpcMain } from 'electron'
import { getPublicSettings, setSettings } from '../settings'
import type { AnvilSettings } from '../../shared/settings'

export function registerSettingsIpc(ipcMain: IpcMain): void {
  ipcMain.handle('settings:get', () => getPublicSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<AnvilSettings>) => setSettings(patch))
}
