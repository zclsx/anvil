import { useReducer, useCallback } from 'react'

export type RightTab =
  | { id: string; kind: 'task' }
  | { id: string; kind: 'inspector'; itemId: string }
  | { id: string; kind: 'preview'; filePath: string; title: string }

export interface RightPanelState {
  tabs: RightTab[]
  activeTabId: string | null
}

export type RightPanelAction =
  | { type: 'openInspector'; itemId: string }
  | { type: 'followInspector'; itemId: string }
  | { type: 'openPreview'; filePath: string; title: string }
  | { type: 'closeTab'; id: string }
  | { type: 'setActive'; id: string }
  | { type: 'reset' }

export const INSPECTOR_TAB_ID = 'inspector'
export const TASK_TAB_ID = 'task'

const TASK_TAB: RightTab = { id: TASK_TAB_ID, kind: 'task' }

export const initialRightPanelState: RightPanelState = { tabs: [TASK_TAB], activeTabId: TASK_TAB_ID }

function previewTabId(filePath: string): string {
  return `preview:${filePath}`
}

export function rightPanelReducer(state: RightPanelState, action: RightPanelAction): RightPanelState {
  switch (action.type) {
    case 'openInspector': {
      const existing = state.tabs.find((t) => t.id === INSPECTOR_TAB_ID)
      const inspector: RightTab = { id: INSPECTOR_TAB_ID, kind: 'inspector', itemId: action.itemId }
      const tabs = existing
        ? state.tabs.map((t) => (t.id === INSPECTOR_TAB_ID ? inspector : t))
        : [TASK_TAB, inspector, ...state.tabs.filter((t) => t.id !== TASK_TAB_ID)]
      return { tabs, activeTabId: INSPECTOR_TAB_ID }
    }
    case 'followInspector': {
      const existing = state.tabs.find((t) => t.id === INSPECTOR_TAB_ID)
      if (!existing) return state
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === INSPECTOR_TAB_ID
            ? { id: INSPECTOR_TAB_ID, kind: 'inspector', itemId: action.itemId }
            : t,
        ),
      }
    }
    case 'openPreview': {
      const id = previewTabId(action.filePath)
      if (state.tabs.some((t) => t.id === id)) {
        return { ...state, activeTabId: id }
      }
      const tab: RightTab = { id, kind: 'preview', filePath: action.filePath, title: action.title }
      const tabs = state.tabs.some((t) => t.id === TASK_TAB_ID) ? state.tabs : [TASK_TAB, ...state.tabs]
      return { tabs: [...tabs, tab], activeTabId: id }
    }
    case 'closeTab': {
      if (action.id === TASK_TAB_ID) return state
      const idx = state.tabs.findIndex((t) => t.id === action.id)
      if (idx === -1) return state
      const tabs = state.tabs.filter((t) => t.id !== action.id)
      let activeTabId = state.activeTabId
      if (state.activeTabId === action.id) {
        activeTabId = tabs.length === 0 ? TASK_TAB_ID : tabs[Math.min(idx, tabs.length - 1)].id
      }
      return { tabs: tabs.length === 0 ? [TASK_TAB] : tabs, activeTabId }
    }
    case 'setActive': {
      if (!state.tabs.some((t) => t.id === action.id)) return state
      return { ...state, activeTabId: action.id }
    }
    case 'reset':
      return initialRightPanelState
    default:
      return state
  }
}

export function useRightPanelTabs() {
  const [state, dispatch] = useReducer(rightPanelReducer, initialRightPanelState)

  const openInspector = useCallback((itemId: string) => dispatch({ type: 'openInspector', itemId }), [])
  const followInspector = useCallback((itemId: string) => dispatch({ type: 'followInspector', itemId }), [])
  const openPreview = useCallback(
    (filePath: string, title: string) => dispatch({ type: 'openPreview', filePath, title }),
    [],
  )
  const closeTab = useCallback((id: string) => dispatch({ type: 'closeTab', id }), [])
  const setActive = useCallback((id: string) => dispatch({ type: 'setActive', id }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  return {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    openInspector,
    followInspector,
    openPreview,
    closeTab,
    setActive,
    reset,
  }
}
