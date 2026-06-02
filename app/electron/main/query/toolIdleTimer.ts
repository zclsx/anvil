import type { AgentEvent } from '../../shared/events'

export interface ToolIdleState {
  activeToolItemIds: ReadonlySet<string>
  permissionStartedToolItemIds: ReadonlySet<string>
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
  }
}

export function markToolPermissionAllowed(state: ToolIdleState, itemId: string): ToolIdleTransition {
  const activeToolItemIds = new Set(state.activeToolItemIds)
  const permissionStartedToolItemIds = new Set(state.permissionStartedToolItemIds)

  if (activeToolItemIds.has(itemId)) {
    return {
      state: {
        activeToolItemIds,
        permissionStartedToolItemIds,
      },
      clearIdleTimer: false,
      resetIdleTimer: false,
    }
  }

  const wasIdle = activeToolItemIds.size === 0
  activeToolItemIds.add(itemId)
  permissionStartedToolItemIds.add(itemId)

  return {
    state: {
      activeToolItemIds,
      permissionStartedToolItemIds,
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
        },
        clearIdleTimer: false,
        resetIdleTimer: false,
      }
    }

    const wasIdle = activeToolItemIds.size === 0
    activeToolItemIds.add(event.itemId)

    return {
      state: {
        activeToolItemIds,
        permissionStartedToolItemIds,
      },
      clearIdleTimer: wasIdle,
      resetIdleTimer: false,
    }
  }

  if (event.type === 'tool.result') {
    if (!event.itemId || !activeToolItemIds.has(event.itemId)) {
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
      },
      clearIdleTimer: false,
      resetIdleTimer: activeToolItemIds.size === 0 && canResetIdle,
    }
  }

  return {
    state,
    clearIdleTimer: false,
    resetIdleTimer: false,
  }
}
