import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSettings, setSettings, type AnvilSettings } from './settings'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('settings:get', () => {
  return getSettings()
})

ipcMain.handle('settings:set', (_event, patch: Partial<AnvilSettings>) => {
  return setSettings(patch)
})

ipcMain.handle('agent:query', async (_event, args: { prompt: string }) => {
  const { query } = await import('@anthropic-ai/claude-agent-sdk')
  const settings = getSettings()

  if (!settings.apiKey) {
    throw new Error('API Key 未配置，请在 Settings 里填写')
  }

  process.env.ANTHROPIC_BASE_URL = settings.baseUrl
  process.env.ANTHROPIC_API_KEY = settings.apiKey

  const q = query({
    prompt: args.prompt,
    options: settings.model ? { model: settings.model } : {},
  })

  const messages: unknown[] = []
  for await (const msg of q) {
    messages.push(msg)
    mainWindow?.webContents.send('agent:message', msg)
  }

  return { ok: true, count: messages.length }
})
