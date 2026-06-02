import type { AgentEvent } from '../../shared/events'

export interface ToolIdleTransition {
  activeToolCount: number
  clearIdleTimer: boolean
  resetIdleTimer: boolean
}

export function updateToolIdleState(
  activeToolCount: number,
  event: Pick<AgentEvent, 'type'>,
  canResetIdle: boolean,
): ToolIdleTransition {
  if (event.type === 'tool.started') {
    return {
      activeToolCount: activeToolCount + 1,
      clearIdleTimer: activeToolCount === 0,
      resetIdleTimer: false,
    }
  }

  if (event.type === 'tool.result') {
    if (activeToolCount === 0) {
      return {
        activeToolCount: 0,
        clearIdleTimer: false,
        resetIdleTimer: false,
      }
    }

    const nextCount = activeToolCount - 1
    return {
      activeToolCount: nextCount,
      clearIdleTimer: false,
      resetIdleTimer: nextCount === 0 && canResetIdle,
    }
  }

  return {
    activeToolCount,
    clearIdleTimer: false,
    resetIdleTimer: false,
  }
}
