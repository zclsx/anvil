import { test, expect, type Page, type TestInfo } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mainEntry = path.resolve(__dirname, '..', '..', 'dist-electron', 'main', 'index.js')

let currentElectronApp: ElectronApplication | undefined

test.beforeAll(async () => {
  if (!fs.existsSync(mainEntry)) {
    test.skip(
      true,
      `Electron main entry not found at ${mainEntry}. Run 'npm run build' before running theme tests.`,
    )
    return
  }
})

test.afterEach(async () => {
  if (currentElectronApp) {
    await currentElectronApp.close()
    currentElectronApp = undefined
  }
})

async function launchIsolatedApp(testInfo: TestInfo): Promise<Page> {
  const userDataDir = testInfo.outputPath('user-data')
  await fs.promises.rm(userDataDir, { recursive: true, force: true })
  await fs.promises.mkdir(userDataDir, { recursive: true })

  currentElectronApp = await electron.launch({
    args: [`--user-data-dir=${userDataDir}`, mainEntry],
    timeout: 30_000,
  })

  const win = await getAppWindow(currentElectronApp)
  await win.waitForFunction(() => 'anvil' in window, undefined, { timeout: 10_000 })
  return win
}

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

test.describe('Anvil Premium Theme Switcher E2E Test Suite', () => {
  test('1. Default theme boot is dark', async ({}, testInfo) => {
    const win = await launchIsolatedApp(testInfo)

    const htmlClass = await win.locator('html').getAttribute('class')
    expect(htmlClass).toContain('dark')

    const savedTheme = await win.evaluate(() => localStorage.getItem('anvil-theme'))
    expect(savedTheme === null || savedTheme === 'dark').toBe(true)

    const toggleBtn = win.locator('button:has-text("Light")')
    await expect(toggleBtn).toBeVisible()
  })

  test('2. Toggling theme switches to light and updates localStorage', async ({}, testInfo) => {
    const win = await launchIsolatedApp(testInfo)

    const toggleBtn = win.locator('button:has-text("Light")')
    await toggleBtn.click()

    const htmlClassList = await win.locator('html').getAttribute('class')
    expect(htmlClassList || '').not.toContain('dark')

    const savedTheme = await win.evaluate(() => localStorage.getItem('anvil-theme'))
    expect(savedTheme).toBe('light')

    const toggleBtnDark = win.locator('button:has-text("Dark")')
    await expect(toggleBtnDark).toBeVisible()
  })

  test('3. Reloading window preserves light theme state (persistence)', async ({}, testInfo) => {
    const win = await launchIsolatedApp(testInfo)

    await win.locator('button:has-text("Light")').click()
    await win.reload()
    await win.waitForFunction(() => 'anvil' in window, undefined, { timeout: 5000 })

    const htmlClassList = await win.locator('html').getAttribute('class')
    expect(htmlClassList || '').not.toContain('dark')

    const savedTheme = await win.evaluate(() => localStorage.getItem('anvil-theme'))
    expect(savedTheme).toBe('light')
  })

  test('4. CSS variables resolve to correct colors in light/dark mode', async ({}, testInfo) => {
    const win = await launchIsolatedApp(testInfo)

    await win.locator('button:has-text("Light")').click()

    const lightVarProperty = await win.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-token-property').trim()
    })
    expect(lightVarProperty.toLowerCase()).toBe('#1d4ed8')

    const toggleBtn = win.locator('button:has-text("Dark")')
    await toggleBtn.click()

    const darkVarProperty = await win.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-token-property').trim()
    })
    expect(darkVarProperty.toLowerCase()).toBe('#afc4ff')
  })
})
