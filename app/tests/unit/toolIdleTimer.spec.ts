import { test, expect } from 'vitest'
import type { AgentEvent } from '../../electron/shared/events'
import {
  createToolIdleState,
  hasActiveToolIdlePause,
  markToolPermissionAllowed,
  updateToolIdleState,
} from '../../electron/main/query/toolIdleTimer'

function toolStarted(toolUseId: string, toolName = 'Bash'): Extract<AgentEvent, { type: 'tool.started' }> {
  return {
    type: 'tool.started',
    sessionId: 'session',
    turnId: 'turn',
    itemId: `tool:${toolUseId}`,
    toolName,
    input: {},
    seq: 1,
    timestamp: '2026-06-02T00:00:00.000Z',
  }
}

function toolResult(toolUseId: string): Extract<AgentEvent, { type: 'tool.result' }> {
  return {
    type: 'tool.result',
    sessionId: 'session',
    turnId: 'turn',
    itemId: `tool:${toolUseId}`,
    output: 'done',
    isError: false,
    seq: 2,
    timestamp: '2026-06-02T00:00:01.000Z',
  }
}

function activeCount(state = createToolIdleState()): number {
  return state.activeToolItemIds.size
}

function permissionlessCount(state = createToolIdleState()): number {
  return state.permissionlessToolCount
}

test.describe('tool idle timer state', () => {
  test('pauses and resumes idle for a non-anvil tool from protocol events', () => {
    const started = updateToolIdleState(createToolIdleState(), toolStarted('bash-1', 'Bash'), true)
    expect(activeCount(started.state)).toBe(1)
    expect(started.clearIdleTimer).toBe(true)
    expect(started.resetIdleTimer).toBe(false)

    const finished = updateToolIdleState(started.state, toolResult('bash-1'), true)
    expect(activeCount(finished.state)).toBe(0)
    expect(finished.clearIdleTimer).toBe(false)
    expect(finished.resetIdleTimer).toBe(true)
  })

  test('marks an approved tool active before the protocol tool.started event arrives', () => {
    const allowed = markToolPermissionAllowed(createToolIdleState(), 'tool:create-docx-1')
    expect(activeCount(allowed.state)).toBe(1)
    expect(allowed.clearIdleTimer).toBe(true)
    expect(allowed.resetIdleTimer).toBe(false)

    const started = updateToolIdleState(
      allowed.state,
      toolStarted('create-docx-1', 'mcp__anvil__create_docx_from_skill'),
      true,
    )
    expect(activeCount(started.state)).toBe(1)
    expect(started.clearIdleTimer).toBe(false)
    expect(started.resetIdleTimer).toBe(false)

    const finished = updateToolIdleState(started.state, toolResult('create-docx-1'), true)
    expect(activeCount(finished.state)).toBe(0)
    expect(finished.resetIdleTimer).toBe(true)
  })

  test('pauses idle when tool approval has no permission context', () => {
    const allowed = markToolPermissionAllowed(createToolIdleState(), null)
    expect(activeCount(allowed.state)).toBe(0)
    expect(permissionlessCount(allowed.state)).toBe(1)
    expect(hasActiveToolIdlePause(allowed.state)).toBe(true)
    expect(allowed.clearIdleTimer).toBe(true)
    expect(allowed.resetIdleTimer).toBe(false)
  })

  test('converts a permissionless pause to a concrete tool when protocol start arrives', () => {
    const allowed = markToolPermissionAllowed(createToolIdleState(), null)
    const started = updateToolIdleState(allowed.state, toolStarted('bash-1'), true)

    expect(permissionlessCount(started.state)).toBe(0)
    expect(activeCount(started.state)).toBe(1)
    expect(started.clearIdleTimer).toBe(false)
    expect(started.resetIdleTimer).toBe(false)

    const finished = updateToolIdleState(started.state, toolResult('bash-1'), true)
    expect(hasActiveToolIdlePause(finished.state)).toBe(false)
    expect(finished.resetIdleTimer).toBe(true)
  })

  test('releases a permissionless pause on an unmatched tool result', () => {
    const allowed = markToolPermissionAllowed(createToolIdleState(), null)
    const finished = updateToolIdleState(allowed.state, toolResult('unknown'), true)

    expect(permissionlessCount(finished.state)).toBe(0)
    expect(hasActiveToolIdlePause(finished.state)).toBe(false)
    expect(finished.resetIdleTimer).toBe(true)
  })

  test('does not double count when protocol tool.started arrives before permission allow', () => {
    const started = updateToolIdleState(createToolIdleState(), toolStarted('bash-1', 'Bash'), true)
    const allowed = markToolPermissionAllowed(started.state, 'tool:bash-1')
    expect(activeCount(allowed.state)).toBe(1)
    expect(allowed.clearIdleTimer).toBe(false)

    const finished = updateToolIdleState(allowed.state, toolResult('bash-1'), true)
    expect(activeCount(finished.state)).toBe(0)
    expect(finished.resetIdleTimer).toBe(true)
  })

  test('does not add a permissionless pause when an active protocol tool already covers it', () => {
    const started = updateToolIdleState(createToolIdleState(), toolStarted('bash-1', 'Bash'), true)
    const allowed = markToolPermissionAllowed(started.state, null)

    expect(activeCount(allowed.state)).toBe(1)
    expect(permissionlessCount(allowed.state)).toBe(0)
    expect(allowed.clearIdleTimer).toBe(false)

    const finished = updateToolIdleState(allowed.state, toolResult('bash-1'), true)
    expect(hasActiveToolIdlePause(finished.state)).toBe(false)
    expect(finished.resetIdleTimer).toBe(true)
  })

  test('keeps idle paused until all concurrent tools finish', () => {
    const first = markToolPermissionAllowed(createToolIdleState(), 'tool:bash-1')
    const second = markToolPermissionAllowed(first.state, 'tool:read-1')
    expect(activeCount(second.state)).toBe(2)
    expect(first.clearIdleTimer).toBe(true)
    expect(second.clearIdleTimer).toBe(false)

    const firstResult = updateToolIdleState(second.state, toolResult('bash-1'), true)
    expect(activeCount(firstResult.state)).toBe(1)
    expect(firstResult.resetIdleTimer).toBe(false)

    const secondResult = updateToolIdleState(firstResult.state, toolResult('read-1'), true)
    expect(activeCount(secondResult.state)).toBe(0)
    expect(secondResult.resetIdleTimer).toBe(true)
  })

  test('does not re-arm idle when another pause source is active', () => {
    const allowed = markToolPermissionAllowed(createToolIdleState(), 'tool:bash-1')
    const finishedDuringApproval = updateToolIdleState(allowed.state, toolResult('bash-1'), false)

    expect(activeCount(finishedDuringApproval.state)).toBe(0)
    expect(finishedDuringApproval.clearIdleTimer).toBe(false)
    expect(finishedDuringApproval.resetIdleTimer).toBe(false)
  })

  test('ignores unmatched tool results', () => {
    const transition = updateToolIdleState(createToolIdleState(), toolResult('missing'), true)
    expect(activeCount(transition.state)).toBe(0)
    expect(transition.clearIdleTimer).toBe(false)
    expect(transition.resetIdleTimer).toBe(false)
  })
})
