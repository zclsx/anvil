import type { BrowserWindow } from 'electron'
import type { ActiveQuery } from './query/errors'

export type ApprovalResolver = (decision: {
  behavior: 'allow' | 'deny'
  updatedInput?: unknown
  message?: string
}) => void

export interface MainRuntimeContext {
  mainWindow: BrowserWindow | null
  activeQuery: ActiveQuery | null
  queryInFlight: boolean
  pendingApprovals: Map<string, ApprovalResolver>
}

export function createRuntimeContext(): MainRuntimeContext {
  return {
    mainWindow: null,
    activeQuery: null,
    queryInFlight: false,
    pendingApprovals: new Map(),
  }
}
