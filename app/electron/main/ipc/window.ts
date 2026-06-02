import type { IpcMain } from 'electron'
import { applyWindowTheme, isWindowTheme } from '../bootstrap/window'
import type { MainRuntimeContext } from '../runtimeContext'

export function registerWindowIpc(ipcMain: IpcMain, ctx: MainRuntimeContext): void {
  ipcMain.handle('window:set-theme', (_e, theme: unknown): { ok: boolean; error?: string } => {
    if (!isWindowTheme(theme)) {
      return { ok: false, error: 'invalid theme' }
    }
    if (!ctx.mainWindow) {
      return { ok: false, error: 'window unavailable' }
    }

    applyWindowTheme(ctx.mainWindow, theme)
    return { ok: true }
  })
}
