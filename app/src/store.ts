import { create } from 'zustand'
import type { AgentEvent, AgentEventEnvelope, AgentRole } from '../electron/shared/events'

export interface Item {
  id: string
  role: AgentRole
  kind: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'unknown'
  text: string
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  toolIsError?: boolean
  createdAt: string
}

export interface Turn {
  id: string
  itemIds: string[]
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  stats?: {
    durationMs?: number
    inputTokens?: number
    outputTokens?: number
    cacheReadTokens?: number
    costUsd?: number
  }
  startedAt: string
  finishedAt?: string
}

interface Store {
  turns: Turn[]
  items: Record<string, Item>
  rawEvents: AgentEventEnvelope[]
  errors: string[]

  ingest: (envelope: AgentEventEnvelope) => void
  reset: () => void
}

export const useAgentStore = create<Store>((set) => ({
  turns: [],
  items: {},
  rawEvents: [],
  errors: [],

  ingest: (envelope) =>
    set((state) => {
      const next = {
        turns: state.turns,
        items: { ...state.items },
        rawEvents: [...state.rawEvents, envelope],
        errors: state.errors,
      }
      applyEvent(next, envelope.event)
      return next
    }),

  reset: () =>
    set(() => ({
      turns: [],
      items: {},
      rawEvents: [],
      errors: [],
    })),
}))

function applyEvent(
  next: { turns: Turn[]; items: Record<string, Item>; errors: string[] },
  event: AgentEvent,
) {
  switch (event.type) {
    case 'turn.started': {
      next.turns = [
        ...next.turns,
        {
          id: event.turnId,
          itemIds: [],
          status: 'running',
          startedAt: event.timestamp,
        },
      ]
      break
    }

    case 'item.added': {
      next.items[event.itemId] = {
        id: event.itemId,
        role: event.role,
        kind: event.kind,
        text: '',
        createdAt: event.timestamp,
      }
      next.turns = next.turns.map((t) =>
        t.id === event.turnId
          ? { ...t, itemIds: [...t.itemIds, event.itemId] }
          : t,
      )
      break
    }

    case 'text.delta': {
      const item = next.items[event.itemId]
      if (item) {
        next.items[event.itemId] = { ...item, text: item.text + event.text }
      }
      break
    }

    case 'tool.started': {
      const item = next.items[event.itemId]
      if (item) {
        next.items[event.itemId] = {
          ...item,
          toolName: event.toolName,
          toolInput: event.input,
        }
      }
      break
    }

    case 'tool.result': {
      const item = next.items[event.itemId]
      if (item) {
        next.items[event.itemId] = {
          ...item,
          toolOutput: event.output,
          toolIsError: event.isError,
        }
      }
      break
    }

    case 'turn.finished': {
      next.turns = next.turns.map((t) =>
        t.id === event.turnId
          ? {
              ...t,
              status: event.status,
              stats: event.stats,
              finishedAt: event.timestamp,
            }
          : t,
      )
      break
    }

    case 'error': {
      next.errors = [...next.errors, event.message]
      break
    }
  }
}
