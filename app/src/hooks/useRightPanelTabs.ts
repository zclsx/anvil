import { useReducer, useCallback } from 'react'

export type RightTab =
  | { id: string; kind: 'inspector'; itemId: string }
  | { id: string; kind: 'preview'; filePath: string; title: string }

export interface RightPanelState {
  tabs: RightTab[]
  activeTabId: string | null
}

export type RightPanelAction =
  | { type: 'openInspector'; itemId: string }
  | { type: 'openPreview'; filePath: string; title: string }
  | { type: 'closeTab'; id: string }
  | { type: 'setActive'; id: string }

export const INSPECTOR_TAB_ID = 'inspector'

export const initialRightPanelState: RightPanelState = { tabs: [], activeTabId: null }

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
        : [inspector, ...state.tabs]
      return { tabs, activeTabId: INSPECTOR_TAB_ID }
    }
    case 'openPreview': {
      const id = previewTabId(action.filePath)
      if (state.tabs.some((t) => t.id === id)) {
        return { ...state, activeTabId: id }
      }
      const tab: RightTab = { id, kind: 'preview', filePath: action.filePath, title: action.title }
      return { tabs: [...state.tabs, tab], activeTabId: id }
    }
    case 'closeTab': {
      const idx = state.tabs.findIndex((t) => t.id === action.id)
      if (idx === -1) return state
      const tabs = state.tabs.filter((t) => t.id !== action.id)
      let activeTabId = state.activeTabId
      if (state.activeTabId === action.id) {
        activeTabId = tabs.length === 0 ? null : tabs[Math.min(idx, tabs.length - 1)].id
      }
      return { tabs, activeTabId }
    }
    case 'setActive': {
      if (!state.tabs.some((t) => t.id === action.id)) return state
      return { ...state, activeTabId: action.id }
    }
    default:
      return state
  }
}

export function useRightPanelTabs() {
  const [state, dispatch] = useReducer(rightPanelReducer, initialRightPanelState)

  const openInspector = useCallback((itemId: string) => dispatch({ type: 'openInspector', itemId }), [])
  const openPreview = useCallback(
    (filePath: string, title: string) => dispatch({ type: 'openPreview', filePath, title }),
    [],
  )
  const closeTab = useCallback((id: string) => dispatch({ type: 'closeTab', id }), [])
  const setActive = useCallback((id: string) => dispatch({ type: 'setActive', id }), [])

  return { tabs: state.tabs, activeTabId: state.activeTabId, openInspector, openPreview, closeTab, setActive }
}
