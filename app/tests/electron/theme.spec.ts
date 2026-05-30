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
      `Electron main entry not found at ${mainEntry}. Run 'npm run build' before running theme tests.`,
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

test.describe('Anvil Premium Theme Switcher E2E Test Suite', () => {
  test('1. Default theme boot is dark', async () => {
    if (!electronApp) return
    const win = await getAppWindow(electronApp)
    await win.waitForFunction(() => 'anvil' in window, undefined, { timeout: 10_000 })

    // Default theme should be dark
    const htmlClass = await win.locator('html').getAttribute('class')
    expect(htmlClass).toContain('dark')

    // LocalStorage should initially be empty or default
    const savedTheme = await win.evaluate(() => localStorage.getItem('anvil-theme'))
    expect(savedTheme === null || savedTheme === 'dark').toBe(true)

    // Header toggle button should display Light option
    const toggleBtn = win.locator('button:has-text("Light")')
    await expect(toggleBtn).toBeVisible()
  })

  test('2. Toggling theme switches to light and updates localStorage', async () => {
    if (!electronApp) return
    const win = await getAppWindow(electronApp)

    // Ensure we are starting in dark mode, then toggle
    await win.evaluate(() => localStorage.removeItem('anvil-theme'))
    await win.reload()
    await win.waitForFunction(() => 'anvil' in window, undefined, { timeout: 5000 })

    const toggleBtn = win.locator('button:has-text("Light")')
    await toggleBtn.click()

    // HTML dark class should be removed
    const htmlClassList = await win.locator('html').getAttribute('class')
    expect(htmlClassList || '').not.toContain('dark')

    // LocalStorage must be saved as "light"
    const savedTheme = await win.evaluate(() => localStorage.getItem('anvil-theme'))
    expect(savedTheme).toBe('light')

    // Button label should flip to Dark
    const toggleBtnDark = win.locator('button:has-text("Dark")')
    await expect(toggleBtnDark).toBeVisible()
  })

  test('3. Reloading window preserves light theme state (persistence)', async () => {
    if (!electronApp) return
    const win = await getAppWindow(electronApp)

    // Page reload
    await win.reload()
    await win.waitForFunction(() => 'anvil' in window, undefined, { timeout: 5000 })

    // Check light mode still active on boot
    const htmlClassList = await win.locator('html').getAttribute('class')
    expect(htmlClassList || '').not.toContain('dark')

    const savedTheme = await win.evaluate(() => localStorage.getItem('anvil-theme'))
    expect(savedTheme).toBe('light')
  })

  test('4. CSS variables resolve to correct colors in light/dark mode', async () => {
    if (!electronApp) return
    const win = await getAppWindow(electronApp)

    // 4.1 Check light mode colors
    await win.evaluate(() => localStorage.setItem('anvil-theme', 'light'))
    await win.reload()
    await win.waitForFunction(() => 'anvil' in window, undefined, { timeout: 5000 })

    const lightVarProperty = await win.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-token-property').trim()
    })
    expect(lightVarProperty.toLowerCase()).toBe('#005cc5')

    // 4.2 Switch to dark mode and check dark mode colors
    const toggleBtn = win.locator('button:has-text("Dark")')
    await toggleBtn.click()

    const darkVarProperty = await win.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-token-property').trim()
    })
    expect(darkVarProperty.toLowerCase()).toBe('#8e9192')

    // Cleanup
    await win.evaluate(() => localStorage.removeItem('anvil-theme'))
  })
})
