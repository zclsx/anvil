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
  await expect(page.getByText('失败').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('first response timeout')).toHaveCount(0)
})

test('sending again from a session with a historical error keeps that error dismissed', async ({ page }) => {
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
        lastStatus: 'completed',
        turnCount: 2,
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
          message: '请求已取消',
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
          status: 'cancelled',
          seq: 3,
          timestamp: now,
        },
      },
      { event: { type: 'turn.started', sessionId: 'old1', turnId: 't2', seq: 4, timestamp: now } },
      {
        event: {
          type: 'turn.finished',
          sessionId: 'old1',
          turnId: 't2',
          status: 'completed',
          seq: 5,
          timestamp: now,
        },
      },
    ],
    queryResult: { ok: true, sessionId: 'old1' },
  })

  await page.goto('/')
  await expect(page.getByText('Old session')).toBeVisible({ timeout: 5_000 })

  await page.getByText('Old session').click()
  await expect(page.getByText(/id old1/i)).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('请求已取消')).toHaveCount(0)

  await page.locator('textarea').fill('继续测试')
  await page.getByRole('button', { name: '发送', exact: true }).click()

  await page.waitForFunction(() => {
    const ctl = (window as unknown as { __anvilTestControl?: { getCalls: (c: string) => unknown[] } }).__anvilTestControl
    return ctl && ctl.getCalls('agent:query').length > 0
  })
  await expect(page.getByText('请求已取消')).toHaveCount(0)
})
