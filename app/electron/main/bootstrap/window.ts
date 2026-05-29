import fs from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, nativeImage } from 'electron'
import { bindUpdateWindow } from '../updater'
import type { MainRuntimeContext } from '../runtimeContext'

const APP_NAME = 'Anvil'

export function createWindow(ctx: MainRuntimeContext, projectRoot: string, mainDirname: string): void {
  const isDev = !app.isPackaged
  const iconPath = path.join(projectRoot, 'build', 'icon.png')
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(mainDirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    title: APP_NAME,
    ...(process.platform !== 'darwin' ? { autoHideMenuBar: true } : {}),
    ...(icon ? { icon } : {}),
  })
  if (process.platform !== 'darwin') {
    mainWindow.setMenuBarVisibility(false)
  }

  ctx.mainWindow = mainWindow
  bindUpdateWindow(mainWindow)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(mainDirname, '..', '..', 'dist', 'index.html'))
  }
}
