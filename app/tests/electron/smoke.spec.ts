import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mainEntry = path.resolve(__dirname, '..', '..', 'dist-electron', 'main', 'index.js')

let electronApp: ElectronApplication | undefined

test.beforeAll(async () => {
  if (!fs.existsSync(mainEntry)) {
    test.skip(
      true,
      `Electron main entry not found at ${mainEntry}. Run 'npm run build' (or 'tsc -b && vite build') before running electron smoke tests.`,
    )
    return
  }
  electronApp = await electron.launch({
    args: [mainEntry],
    timeout: 30_000,
  })
})

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close()
  }
})

async function getAppWindow(app: ElectronApplication, timeoutMs = 15_000): Promise<Page> {
  await app.firstWindow({ timeout: timeoutMs })
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      const url = w.url()
      if (!url.startsWith('devtools://')) {
        return w
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('No app window (non-devtools) found within timeout')
}

test('app boots and exposes window.anvil via preload', async () => {
  if (!electronApp) return
  const win = await getAppWindow(electronApp)
  await win.waitForFunction(
    () => 'anvil' in window,
    undefined,
    { timeout: 10_000 },
  )

  const anvilKeys = await win.evaluate(() => {
    const w = window as unknown as { anvil?: Record<string, unknown> }
    return w.anvil ? Object.keys(w.anvil).sort() : []
  })
  expect(anvilKeys).toEqual(
    expect.arrayContaining(['settings', 'sessions', 'query', 'cancel', 'approval', 'dialog']),
  )
})

test('settings:get IPC returns a valid settings object', async () => {
  if (!electronApp) return
  const win = await getAppWindow(electronApp)

  const settings = await win.evaluate(async () => {
    const w = window as unknown as {
      anvil: { settings: { get: () => Promise<Record<string, unknown>> } }
    }
    return w.anvil.settings.get()
  })

  expect(settings).toBeTruthy()
  expect(typeof settings.baseUrl).toBe('string')
  expect(typeof settings.model).toBe('string')
  expect(typeof settings.workspacePath).toBe('string')
  expect(typeof settings.hasApiKey).toBe('boolean')
})

test('sessions:list IPC returns an array', async () => {
  if (!electronApp) return
  const win = await getAppWindow(electronApp)

  const sessions = await win.evaluate(async () => {
    const w = window as unknown as {
      anvil: { sessions: { list: () => Promise<unknown[]> } }
    }
    return w.anvil.sessions.list()
  })

  expect(Array.isArray(sessions)).toBe(true)
})
