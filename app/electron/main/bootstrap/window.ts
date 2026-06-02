import fs from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, nativeImage, type BrowserWindowConstructorOptions } from 'electron'
import { bindUpdateWindow } from '../updater'
import type { MainRuntimeContext } from '../runtimeContext'

const APP_NAME = 'Anvil'
const WINDOWS_TITLE_BAR_HEIGHT = 48
const INITIAL_WINDOW_THEME: WindowTheme = 'dark'

const WINDOW_CHROME = {
  dark: {
    backgroundColor: '#0B0B0C',
    titleBarOverlayColor: '#0E0E12',
    symbolColor: '#C2C6D8',
  },
  light: {
    backgroundColor: '#F6F7F9',
    titleBarOverlayColor: '#FFFFFF',
    symbolColor: '#1D1D1F',
  },
} as const

export type WindowTheme = keyof typeof WINDOW_CHROME

export function isWindowTheme(value: unknown): value is WindowTheme {
  return value === 'dark' || value === 'light'
}

function getTitleBarOptions(theme: WindowTheme): Pick<BrowserWindowConstructorOptions, 'titleBarStyle' | 'titleBarOverlay'> {
  if (process.platform === 'darwin') {
    return { titleBarStyle: 'hiddenInset' }
  }

  if (process.platform === 'win32') {
    const chrome = WINDOW_CHROME[theme]
    return {
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: chrome.titleBarOverlayColor,
        symbolColor: chrome.symbolColor,
        height: WINDOWS_TITLE_BAR_HEIGHT,
      },
    }
  }

  return {}
}

export function applyWindowTheme(mainWindow: BrowserWindow, theme: WindowTheme): void {
  const chrome = WINDOW_CHROME[theme]
  mainWindow.setBackgroundColor(chrome.backgroundColor)

  if (process.platform === 'win32') {
    mainWindow.setTitleBarOverlay({
      color: chrome.titleBarOverlayColor,
      symbolColor: chrome.symbolColor,
      height: WINDOWS_TITLE_BAR_HEIGHT,
    })
  }
}

export function createWindow(ctx: MainRuntimeContext, projectRoot: string, mainDirname: string): void {
  const isDev = !app.isPackaged
  const iconPath = path.join(projectRoot, 'build', 'icon.png')
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined
  const chrome = WINDOW_CHROME[INITIAL_WINDOW_THEME]

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: chrome.backgroundColor,
    webPreferences: {
      preload: path.join(mainDirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    ...getTitleBarOptions(INITIAL_WINDOW_THEME),
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
    void mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    void mainWindow.loadFile(path.join(mainDirname, '..', '..', 'dist', 'index.html'))
  }
}
