import { test, expect } from '@playwright/test'
import { setupMockAnvil } from '../helpers/mockAnvil'

const now = new Date().toISOString()

test('session replay does not resurrect stale approval requests as actionable approvals', async ({ page }) => {
  await setupMockAnvil(page, {
    settings: { hasApiKey: true, workspacePath: '/Users/test/proj' },
    workspaceExists: true,
    sessions: [
      {
        id: 'stale-approval',
        workspacePath: '/Users/test/proj',
        title: 'Interrupted approval session',
        firstPrompt: 'make a doc',
        createdAt: now,
        updatedAt: now,
        lastStatus: 'completed',
        turnCount: 1,
        totalCostUsd: 0,
      },
    ],
    sessionEvents: [
      {
        event: {
          type: 'turn.started',
          sessionId: 'stale-approval',
          turnId: 'turn-1',
          seq: 1,
          timestamp: now,
        },
      },
      {
        event: {
          type: 'approval.requested',
          sessionId: 'stale-approval',
          turnId: 'turn-1',
          itemId: 'approval:stale',
          request: {
            approvalId: 'stale',
            toolName: 'mcp__anvil__create_docx_from_skill',
            input: { path: '/Users/test/proj/out.docx' },
            risk: 'high',
          },
          seq: 2,
          timestamp: now,
        },
      },
    ],
  })

  await page.goto('/')
  await expect(page.getByText('Interrupted approval session')).toBeVisible({ timeout: 5_000 })

  await page.getByText('Interrupted approval session').click()

  await expect(page.getByText(/等待审批/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: '允许' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '拒绝' })).toHaveCount(0)
})
