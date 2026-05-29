import { test, expect } from '@playwright/test'
import { setupMockAnvil } from '../helpers/mockAnvil'

const now = new Date().toISOString()

test('switching to a session with a historical error does not pop the error banner', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
    sessions: [
      {
        id: 'old1',
        workspacePath: '/Users/test/proj',
        title: 'Old session',
        firstPrompt: 'hi',
        createdAt: now,
        updatedAt: now,
        lastStatus: 'failed',
        turnCount: 1,
        totalCostUsd: 0,
      },
    ],
    sessionEvents: [
      { event: { type: 'turn.started', sessionId: 'old1', turnId: 't1', seq: 1, timestamp: now } },
      {
        event: {
          type: 'error',
          sessionId: 'old1',
          turnId: 't1',
          message: '上游 15s 内无响应（first response timeout）',
          recoverable: false,
          seq: 2,
          timestamp: now,
        },
      },
      {
        event: {
          type: 'turn.finished',
          sessionId: 'old1',
          turnId: 't1',
          status: 'failed',
          seq: 3,
          timestamp: now,
        },
      },
    ],
  })

  await page.goto('/')
  await expect(page.getByText('Old session')).toBeVisible({ timeout: 5_000 })

  await page.getByText('Old session').click()

  // give replay a beat, then assert the stale error is not shown as a banner
  await expect(page.getByText('failed').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('first response timeout')).toHaveCount(0)
})
