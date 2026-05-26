import { randomUUID } from 'node:crypto'
import type { AgentEvent, AgentEventEnvelope } from '../shared/events'

interface AdapterState {
  sessionId: string
  turnId: string
  seq: number
  itemsByMessageId: Map<string, string>
  toolUseIdToItemId: Map<string, string>
  startTime: number
}

export function createAdapter(): {
  start: () => void
  ingest: (raw: any) => AgentEventEnvelope[]
  finish: (status: 'completed' | 'failed' | 'cancelled') => AgentEventEnvelope
  fail: (message: string) => AgentEventEnvelope
} {
  const state: AdapterState = {
    sessionId: '',
    turnId: randomUUID(),
    seq: 0,
    itemsByMessageId: new Map(),
    toolUseIdToItemId: new Map(),
    startTime: Date.now(),
  }

  function nextSeq() {
    return ++state.seq
  }

  function now() {
    return new Date().toISOString()
  }

  function envelope(event: AgentEvent, raw?: unknown): AgentEventEnvelope {
    return { event, raw }
  }

  return {
    start() {
      state.startTime = Date.now()
    },

    ingest(raw: any): AgentEventEnvelope[] {
      const out: AgentEventEnvelope[] = []
      if (!raw || typeof raw !== 'object') return out

      switch (raw.type) {
        case 'system': {
          if (raw.subtype === 'init' && raw.session_id) {
            state.sessionId = String(raw.session_id)
            out.push(
              envelope(
                {
                  type: 'turn.started',
                  sessionId: state.sessionId,
                  turnId: state.turnId,
                  seq: nextSeq(),
                  timestamp: now(),
                },
                raw,
              ),
            )
          }
          break
        }

        case 'assistant': {
          const message = raw.message
          if (!message || !Array.isArray(message.content)) break
          const messageId: string = message.id ?? randomUUID()

          for (const block of message.content) {
            if (!block || typeof block !== 'object') continue

            if (block.type === 'text') {
              const itemId = `${messageId}:text`
              if (!state.itemsByMessageId.has(itemId)) {
                state.itemsByMessageId.set(itemId, itemId)
                out.push(
                  envelope({
                    type: 'item.added',
                    sessionId: state.sessionId,
                    turnId: state.turnId,
                    itemId,
                    role: 'assistant',
                    kind: 'text',
                    seq: nextSeq(),
                    timestamp: now(),
                  }),
                )
              }
              const text = typeof block.text === 'string' ? block.text : ''
              if (text) {
                out.push(
                  envelope({
                    type: 'text.delta',
                    sessionId: state.sessionId,
                    turnId: state.turnId,
                    itemId,
                    text,
                    seq: nextSeq(),
                    timestamp: now(),
                  }),
                )
              }
            } else if (block.type === 'thinking') {
              const itemId = `${messageId}:thinking`
              if (!state.itemsByMessageId.has(itemId)) {
                state.itemsByMessageId.set(itemId, itemId)
                out.push(
                  envelope({
                    type: 'item.added',
                    sessionId: state.sessionId,
                    turnId: state.turnId,
                    itemId,
                    role: 'assistant',
                    kind: 'thinking',
                    seq: nextSeq(),
                    timestamp: now(),
                  }),
                )
              }
              const text = typeof block.thinking === 'string' ? block.thinking : ''
              if (text) {
                out.push(
                  envelope({
                    type: 'text.delta',
                    sessionId: state.sessionId,
                    turnId: state.turnId,
                    itemId,
                    text,
                    seq: nextSeq(),
                    timestamp: now(),
                  }),
                )
              }
            } else if (block.type === 'tool_use') {
              const toolUseId = block.id ?? randomUUID()
              const itemId = `tool:${toolUseId}`
              if (!state.toolUseIdToItemId.has(toolUseId)) {
                state.toolUseIdToItemId.set(toolUseId, itemId)
                out.push(
                  envelope({
                    type: 'item.added',
                    sessionId: state.sessionId,
                    turnId: state.turnId,
                    itemId,
                    role: 'tool',
                    kind: 'tool_use',
                    seq: nextSeq(),
                    timestamp: now(),
                  }),
                )
                out.push(
                  envelope({
                    type: 'tool.started',
                    sessionId: state.sessionId,
                    turnId: state.turnId,
                    itemId,
                    toolName: String(block.name ?? 'unknown'),
                    input: block.input,
                    seq: nextSeq(),
                    timestamp: now(),
                  }),
                )
              }
            }
          }
          break
        }

        case 'user': {
          const message = raw.message
          if (!message || !Array.isArray(message.content)) break
          for (const block of message.content) {
            if (block?.type === 'tool_result') {
              const toolUseId = block.tool_use_id
              const itemId = state.toolUseIdToItemId.get(toolUseId)
              if (itemId) {
                out.push(
                  envelope({
                    type: 'tool.result',
                    sessionId: state.sessionId,
                    turnId: state.turnId,
                    itemId,
                    output: block.content,
                    isError: block.is_error === true,
                    seq: nextSeq(),
                    timestamp: now(),
                  }),
                )
              }
            }
          }
          break
        }

        case 'result': {
          out.push(
            envelope(
              {
                type: 'turn.finished',
                sessionId: state.sessionId,
                turnId: state.turnId,
                status: raw.is_error ? 'failed' : 'completed',
                stats: {
                  durationMs: typeof raw.duration_ms === 'number' ? raw.duration_ms : undefined,
                  inputTokens: raw.usage?.input_tokens,
                  outputTokens: raw.usage?.output_tokens,
                  cacheReadTokens: raw.usage?.cache_read_input_tokens,
                  costUsd: raw.total_cost_usd,
                },
                seq: nextSeq(),
                timestamp: now(),
              },
              raw,
            ),
          )
          break
        }

        default:
          break
      }

      return out
    },

    finish(status) {
      return envelope({
        type: 'turn.finished',
        sessionId: state.sessionId,
        turnId: state.turnId,
        status,
        seq: nextSeq(),
        timestamp: now(),
      })
    },

    fail(message) {
      return envelope({
        type: 'error',
        sessionId: state.sessionId,
        turnId: state.turnId,
        message,
        recoverable: false,
        seq: nextSeq(),
        timestamp: now(),
      })
    },
  }
}
