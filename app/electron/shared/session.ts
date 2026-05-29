export interface SessionMeta {
  id: string
  workspacePath: string
  title: string
  firstPrompt: string
  createdAt: string
  updatedAt: string
  lastStatus: 'running' | 'completed' | 'failed' | 'cancelled' | 'unknown'
  turnCount: number
  totalCostUsd: number
}

export type ApprovalDecision = {
  approvalId: string
  decision: 'allow' | 'deny'
  reason?: string
}

export type QueryRequest =
  | { mode: 'new'; prompt: string; workspacePath: string; referencedPaths?: string[] }
  | { mode: 'resume'; sessionId: string; prompt: string; referencedPaths?: string[] }
