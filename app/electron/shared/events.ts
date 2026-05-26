export type AgentEventBase = {
  sessionId: string
  turnId: string
  seq: number
  timestamp: string
}

export type AgentRole = 'user' | 'assistant' | 'tool' | 'system'

export type RiskLevel = 'low' | 'medium' | 'high'

export type ApprovalRequest = {
  approvalId: string
  toolName: string
  input: unknown
  risk: RiskLevel
  reason?: string
}

export type AgentEvent =
  | (AgentEventBase & {
      type: 'turn.started'
      userPrompt?: string
    })
  | (AgentEventBase & {
      type: 'item.added'
      itemId: string
      role: AgentRole
      kind: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'unknown'
    })
  | (AgentEventBase & {
      type: 'text.delta'
      itemId: string
      text: string
    })
  | (AgentEventBase & {
      type: 'tool.started'
      itemId: string
      toolName: string
      input: unknown
    })
  | (AgentEventBase & {
      type: 'tool.result'
      itemId: string
      output: unknown
      isError: boolean
    })
  | (AgentEventBase & {
      type: 'approval.requested'
      itemId: string
      request: ApprovalRequest
    })
  | (AgentEventBase & {
      type: 'approval.decided'
      approvalId: string
      decision: 'allow' | 'deny'
      reason?: string
    })
  | (AgentEventBase & {
      type: 'turn.finished'
      status: 'completed' | 'failed' | 'cancelled'
      stats?: {
        durationMs?: number
        inputTokens?: number
        outputTokens?: number
        cacheReadTokens?: number
        costUsd?: number
      }
    })
  | {
      type: 'error'
      sessionId?: string
      turnId?: string
      message: string
      recoverable: boolean
      seq: number
      timestamp: string
    }

export type AgentEventEnvelope = {
  event: AgentEvent
  raw?: unknown
}
