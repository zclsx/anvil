import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import {
  getSettings,
  getPublicSettings,
  setSettings,
  bootstrapFromEnv,
} from './settings'
import type { AnvilSettings } from '../shared/settings'
import { createAdapter } from './sdkAdapter'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const projectRoot = path.resolve(__dirname, '..', '..')
loadEnv({ path: path.join(projectRoot, '.env.local') })
loadEnv({ path: path.join(projectRoot, '.env') })

bootstrapFromEnv()

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
  return getPublicSettings()
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

  const adapter = createAdapter()
  adapter.start()

  try {
    const options: any = settings.model ? { model: settings.model } : {}

    if (settings.stitchProjectId) {
      options.mcpServers = {
        stitch: {
          command: 'npx',
          args: ['-y', '@_davideast/stitch-mcp', 'proxy'],
          env: {
            STITCH_PROJECT_ID: settings.stitchProjectId,
            ...process.env,
          },
        },
      }
    }

    const q = query({
      prompt: args.prompt,
      options,
    })

    for await (const msg of q) {
      const envelopes = adapter.ingest(msg)
      for (const env of envelopes) {
        mainWindow?.webContents.send('agent:event', env)
      }
    }
    return { ok: true }
  } catch (err: any) {
    const message = err?.message ?? String(err)
    mainWindow?.webContents.send('agent:event', adapter.fail(message))
    mainWindow?.webContents.send('agent:event', adapter.finish('failed'))
    return { ok: false, error: message }
  }
})
