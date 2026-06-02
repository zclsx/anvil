import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain, Menu, nativeImage } from 'electron'
import { initDb } from './db'
import { registerUpdateIpc } from './updater'
import { createRuntimeContext } from './runtimeContext'
import { loadDevEnv } from './bootstrap/env'
import { createWindow } from './bootstrap/window'
import { registerSettingsIpc } from './ipc/settings'
import { registerSessionsIpc } from './ipc/sessions'
import { registerDialogIpc } from './ipc/dialog'
import { registerApprovalIpc } from './ipc/approval'
import { registerAgentIpc } from './ipc/agent'
import { registerFilesIpc } from './ipc/files'
import { registerWindowIpc } from './ipc/window'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')
const APP_NAME = 'Anvil'
const APP_ID = 'com.anvil.app'

loadDevEnv(projectRoot)

app.setName(APP_NAME)
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

const ctx = createRuntimeContext()

registerSettingsIpc(ipcMain)
registerUpdateIpc()
registerSessionsIpc(ipcMain)
registerDialogIpc(ipcMain, ctx)
registerApprovalIpc(ipcMain, ctx)
registerAgentIpc(ipcMain, ctx)
registerFilesIpc(ipcMain)
registerWindowIpc(ipcMain, ctx)

void app.whenReady().then(() => {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
  }
  initDb()

  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(projectRoot, 'build', 'icon.png')
    if (fs.existsSync(iconPath)) {
      try {
        const icon = nativeImage.createFromPath(iconPath)
        app.dock.setIcon(icon)
      } catch (err) {
        console.error('Failed to set macOS dock icon:', err)
      }
    }
  }

  createWindow(ctx, projectRoot, __dirname)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(ctx, projectRoot, __dirname)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
