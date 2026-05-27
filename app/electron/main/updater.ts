import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateSnapshot } from '../shared/updates'

const DEFAULT_WINDOWS_FEED_URL = 'https://github.com/zclsx/anvil/releases/latest/download/'

let targetWindow: BrowserWindow | null = null
let configured = false
let snapshot: UpdateSnapshot = createInitialSnapshot()

function resolveFeedUrl() {
  return process.env.ANVIL_UPDATE_FEED_URL || process.env.ANVIL_UPDATE_URL || DEFAULT_WINDOWS_FEED_URL
}

function createInitialSnapshot(): UpdateSnapshot {
  const feedUrl = resolveFeedUrl()
  const enabled = app.isPackaged && process.platform === 'win32' && feedUrl.length > 0
  return {
    status: enabled ? 'idle' : 'disabled',
    enabled,
    currentVersion: app.getVersion(),
    feedUrl: enabled ? feedUrl : '',
    message: enabled
      ? undefined
      : app.isPackaged
        ? 'Updates are currently enabled only for Windows builds.'
        : 'Updates are disabled in development builds.',
  }
}

function normalizeUpdateError(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function optionalString(value: string | null | undefined) {
  return value ?? undefined
}

function patchSnapshot(patch: Partial<UpdateSnapshot>) {
  snapshot = {
    ...snapshot,
    ...patch,
    currentVersion: app.getVersion(),
  }
  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.webContents.send('updates:status', snapshot)
  }
  return snapshot
}

function ensureConfigured() {
  if (configured) return
  configured = true

  if (!snapshot.enabled) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: snapshot.feedUrl,
  })

  autoUpdater.on('checking-for-update', () => {
    patchSnapshot({
      status: 'checking',
      message: 'Checking for updates...',
      percent: undefined,
      bytesPerSecond: undefined,
    })
  })

  autoUpdater.on('update-available', (info) => {
    patchSnapshot({
      status: 'available',
      version: info.version,
      releaseName: optionalString(info.releaseName),
      message: `Update ${info.version} is available.`,
      percent: undefined,
      bytesPerSecond: undefined,
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    patchSnapshot({
      status: 'not-available',
      version: info.version,
      releaseName: optionalString(info.releaseName),
      message: 'You are running the latest version.',
      percent: undefined,
      bytesPerSecond: undefined,
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    patchSnapshot({
      status: 'downloading',
      message: 'Downloading update...',
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    patchSnapshot({
      status: 'downloaded',
      version: info.version,
      releaseName: optionalString(info.releaseName),
      message: 'Update downloaded. Restart to install.',
      percent: 100,
      bytesPerSecond: undefined,
    })
  })

  autoUpdater.on('error', (error) => {
    patchSnapshot({
      status: 'error',
      message: normalizeUpdateError(error),
      percent: undefined,
      bytesPerSecond: undefined,
    })
  })
}

export function bindUpdateWindow(window: BrowserWindow) {
  targetWindow = window
  ensureConfigured()
  window.webContents.once('did-finish-load', () => {
    targetWindow?.webContents.send('updates:status', snapshot)
  })
}

export function registerUpdateIpc() {
  ipcMain.handle('updates:get', () => {
    ensureConfigured()
    return snapshot
  })

  ipcMain.handle('updates:check', async () => {
    ensureConfigured()
    if (!snapshot.enabled) return snapshot

    try {
      patchSnapshot({ status: 'checking', message: 'Checking for updates...' })
      await autoUpdater.checkForUpdates()
    } catch (error) {
      patchSnapshot({
        status: 'error',
        message: normalizeUpdateError(error),
        percent: undefined,
        bytesPerSecond: undefined,
      })
    }
    return snapshot
  })

  ipcMain.handle('updates:download', async () => {
    ensureConfigured()
    if (!snapshot.enabled) return snapshot

    if (snapshot.status !== 'available') {
      return patchSnapshot({
        status: 'error',
        message: 'No update is available to download. Check for updates first.',
      })
    }

    patchSnapshot({
      status: 'downloading',
      message: 'Downloading update...',
      percent: 0,
      bytesPerSecond: undefined,
    })

    void autoUpdater.downloadUpdate().catch((error) => {
      patchSnapshot({
        status: 'error',
        message: normalizeUpdateError(error),
        percent: undefined,
        bytesPerSecond: undefined,
      })
    })

    return snapshot
  })

  ipcMain.handle('updates:install', () => {
    ensureConfigured()
    if (!snapshot.enabled) {
      return { ok: false, error: 'Updates are disabled for this build.' }
    }
    if (snapshot.status !== 'downloaded') {
      return { ok: false, error: 'No downloaded update is ready to install.' }
    }
    autoUpdater.quitAndInstall(false, true)
    return { ok: true }
  })
}
