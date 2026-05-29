import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'renderer',
      testMatch: /renderer\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
      },
    },
    {
      name: 'electron',
      testMatch: /electron\/.*\.spec\.ts$/,
    },
    {
      name: 'unit',
      testMatch: /unit\/.*\.spec\.ts$/,
    },
  ],
  webServer: {
    command: 'npm run dev:web',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
