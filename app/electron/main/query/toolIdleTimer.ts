import type { AgentEvent } from '../../shared/events'

export interface ToolIdleState {
  activeToolItemIds: ReadonlySet<string>
  permissionStartedToolItemIds: ReadonlySet<string>
  permissionlessToolCount: number
}

export interface ToolIdleTransition {
  state: ToolIdleState
  clearIdleTimer: boolean
  resetIdleTimer: boolean
}

export function createToolIdleState(): ToolIdleState {
  return {
    activeToolItemIds: new Set(),
    permissionStartedToolItemIds: new Set(),
    permissionlessToolCount: 0,
  }
}

function hasActiveToolPause(state: ToolIdleState): boolean {
  return state.activeToolItemIds.size > 0 || state.permissionlessToolCount > 0
}

export function hasActiveToolIdlePause(state: ToolIdleState): boolean {
  return hasActiveToolPause(state)
}

export function markToolPermissionAllowed(state: ToolIdleState, itemId: string | null): ToolIdleTransition {
  const activeToolItemIds = new Set(state.activeToolItemIds)
  const permissionStartedToolItemIds = new Set(state.permissionStartedToolItemIds)
  const wasIdle = !hasActiveToolPause(state)

  if (!itemId) {
    if (activeToolItemIds.size > 0) {
      return {
        state,
        clearIdleTimer: false,
        resetIdleTimer: false,
      }
    }

    return {
      state: {
        activeToolItemIds,
        permissionStartedToolItemIds,
        permissionlessToolCount: state.permissionlessToolCount + 1,
      },
      clearIdleTimer: wasIdle,
      resetIdleTimer: false,
    }
  }

  if (activeToolItemIds.has(itemId)) {
    return {
      state: {
        activeToolItemIds,
        permissionStartedToolItemIds,
        permissionlessToolCount: state.permissionlessToolCount,
      },
      clearIdleTimer: false,
      resetIdleTimer: false,
    }
  }

  activeToolItemIds.add(itemId)
  permissionStartedToolItemIds.add(itemId)

  return {
    state: {
      activeToolItemIds,
      permissionStartedToolItemIds,
      permissionlessToolCount: state.permissionlessToolCount,
    },
    clearIdleTimer: wasIdle,
    resetIdleTimer: false,
  }
}

export function updateToolIdleState(
  state: ToolIdleState,
  event: Pick<AgentEvent, 'type'> & { itemId?: string },
  canResetIdle: boolean,
): ToolIdleTransition {
  const activeToolItemIds = new Set(state.activeToolItemIds)
  const permissionStartedToolItemIds = new Set(state.permissionStartedToolItemIds)
  let permissionlessToolCount = state.permissionlessToolCount

  if (event.type === 'tool.started') {
    if (!event.itemId) {
      return {
        state,
        clearIdleTimer: false,
        resetIdleTimer: false,
      }
    }

    if (activeToolItemIds.has(event.itemId)) {
      permissionStartedToolItemIds.delete(event.itemId)
      return {
        state: {
          activeToolItemIds,
          permissionStartedToolItemIds,
          permissionlessToolCount,
        },
        clearIdleTimer: false,
        resetIdleTimer: false,
      }
    }

    const wasIdle = !hasActiveToolPause(state)
    if (permissionlessToolCount > 0) {
      permissionlessToolCount--
    }
    activeToolItemIds.add(event.itemId)

    return {
      state: {
        activeToolItemIds,
        permissionStartedToolItemIds,
        permissionlessToolCount,
      },
      clearIdleTimer: wasIdle,
      resetIdleTimer: false,
    }
  }

  if (event.type === 'tool.result') {
    if (!event.itemId || !activeToolItemIds.has(event.itemId)) {
      if (permissionlessToolCount > 0) {
        permissionlessToolCount--
        return {
          state: {
            activeToolItemIds,
            permissionStartedToolItemIds,
            permissionlessToolCount,
          },
          clearIdleTimer: false,
          resetIdleTimer: !hasActiveToolPause({
            activeToolItemIds,
            permissionStartedToolItemIds,
            permissionlessToolCount,
          }) && canResetIdle,
        }
      }

      return {
        state,
        clearIdleTimer: false,
        resetIdleTimer: false,
      }
    }

    activeToolItemIds.delete(event.itemId)
    permissionStartedToolItemIds.delete(event.itemId)

    return {
      state: {
        activeToolItemIds,
        permissionStartedToolItemIds,
        permissionlessToolCount,
      },
      clearIdleTimer: false,
      resetIdleTimer: !hasActiveToolPause({
        activeToolItemIds,
        permissionStartedToolItemIds,
        permissionlessToolCount,
      }) && canResetIdle,
    }
  }

  return {
    state,
    clearIdleTimer: false,
    resetIdleTimer: false,
  }
}
