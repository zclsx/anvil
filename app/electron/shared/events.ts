export type AgentEventBase = {
  sessionId: string
  turnId: string
  seq: number
  timestamp: string
}

export type AgentRole = 'user' | 'assistant' | 'tool' | 'system'

export type AgentEvent =
  | (AgentEventBase & {
      type: 'turn.started'
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
