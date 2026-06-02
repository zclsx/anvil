import { test, expect } from 'vitest'
import type { AgentEvent } from '../../electron/shared/events'
import { updateToolIdleState } from '../../electron/main/query/toolIdleTimer'

function toolStarted(toolName: string): Extract<AgentEvent, { type: 'tool.started' }> {
  return {
    type: 'tool.started',
    sessionId: 'session',
    turnId: 'turn',
    itemId: `tool:${toolName}`,
    toolName,
    input: {},
    seq: 1,
    timestamp: '2026-06-02T00:00:00.000Z',
  }
}

function toolResult(): Extract<AgentEvent, { type: 'tool.result' }> {
  return {
    type: 'tool.result',
    sessionId: 'session',
    turnId: 'turn',
    itemId: 'tool:Bash',
    output: 'done',
    isError: false,
    seq: 2,
    timestamp: '2026-06-02T00:00:01.000Z',
  }
}

test.describe('updateToolIdleState', () => {
  test('pauses and resumes idle for a non-anvil tool', () => {
    const started = updateToolIdleState(0, toolStarted('Bash'), true)
    expect(started).toEqual({
      activeToolCount: 1,
      clearIdleTimer: true,
      resetIdleTimer: false,
    })

    const finished = updateToolIdleState(started.activeToolCount, toolResult(), true)
    expect(finished).toEqual({
      activeToolCount: 0,
      clearIdleTimer: false,
      resetIdleTimer: true,
    })
  })

  test('keeps idle paused until all concurrent tools finish', () => {
    const first = updateToolIdleState(0, toolStarted('Bash'), true)
    const second = updateToolIdleState(first.activeToolCount, toolStarted('Read'), true)
    expect(first.clearIdleTimer).toBe(true)
    expect(second).toEqual({
      activeToolCount: 2,
      clearIdleTimer: false,
      resetIdleTimer: false,
    })

    const firstResult = updateToolIdleState(second.activeToolCount, toolResult(), true)
    expect(firstResult).toEqual({
      activeToolCount: 1,
      clearIdleTimer: false,
      resetIdleTimer: false,
    })

    const secondResult = updateToolIdleState(firstResult.activeToolCount, toolResult(), true)
    expect(secondResult).toEqual({
      activeToolCount: 0,
      clearIdleTimer: false,
      resetIdleTimer: true,
    })
  })

  test('does not re-arm idle when another pause source is active', () => {
    const started = updateToolIdleState(0, toolStarted('Bash'), true)
    const finishedDuringApproval = updateToolIdleState(started.activeToolCount, toolResult(), false)

    expect(finishedDuringApproval).toEqual({
      activeToolCount: 0,
      clearIdleTimer: false,
      resetIdleTimer: false,
    })
  })

  test('ignores unmatched tool results', () => {
    expect(updateToolIdleState(0, toolResult(), true)).toEqual({
      activeToolCount: 0,
      clearIdleTimer: false,
      resetIdleTimer: false,
    })
  })
})
