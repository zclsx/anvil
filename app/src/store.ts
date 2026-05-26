import { create } from 'zustand'
import type {
  AgentEvent,
  AgentEventEnvelope,
  AgentRole,
  ApprovalRequest,
} from '../electron/shared/events'
import type { SessionMeta } from '../electron/shared/session'

export interface Item {
  id: string
  role: AgentRole
  kind: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'unknown'
  text: string
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  toolIsError?: boolean
  approvalId?: string
  approvalDecision?: 'allow' | 'deny'
  approvalRisk?: 'low' | 'medium' | 'high'
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

export interface PendingApproval {
  approvalId: string
  itemId: string
  toolName: string
  input: unknown
  risk: 'low' | 'medium' | 'high'
  reason?: string
  createdAt: string
}

interface Store {
  sessionId: string | null
  turns: Turn[]
  items: Record<string, Item>
  rawEvents: AgentEventEnvelope[]
  errors: string[]
  pendingApprovals: PendingApproval[]

  sessions: SessionMeta[]

  setSessions: (sessions: SessionMeta[]) => void
  ingest: (envelope: AgentEventEnvelope) => void
  loadFromEvents: (envelopes: AgentEventEnvelope[]) => void
  reset: () => void
  pushError: (message: string) => void
  resolveApproval: (approvalId: string) => void
}

export const useAgentStore = create<Store>((set) => ({
  sessionId: null,
  turns: [],
  items: {},
  rawEvents: [],
  errors: [],
  pendingApprovals: [],
  sessions: [],

  setSessions: (sessions) => set({ sessions }),

  ingest: (envelope) =>
    set((state) => {
      const next = applyEnvelope(state, envelope)
      return next
    }),

  loadFromEvents: (envelopes) =>
    set(() => {
      let state: PartialStoreState = {
        sessionId: null,
        turns: [],
        items: {},
        rawEvents: [],
        errors: [],
        pendingApprovals: [],
      }
      for (const env of envelopes) {
        state = applyEnvelope(state, env)
      }
      return state as Partial<Store>
    }),

  reset: () =>
    set(() => ({
      sessionId: null,
      turns: [],
      items: {},
      rawEvents: [],
      errors: [],
      pendingApprovals: [],
    })),

  pushError: (message) => set((state) => ({ errors: [...state.errors, message] })),

  resolveApproval: (approvalId) =>
    set((state) => ({
      pendingApprovals: state.pendingApprovals.filter((p) => p.approvalId !== approvalId),
    })),
}))

type PartialStoreState = Pick<
  Store,
  'sessionId' | 'turns' | 'items' | 'rawEvents' | 'errors' | 'pendingApprovals'
>

function applyEnvelope(state: PartialStoreState, envelope: AgentEventEnvelope): PartialStoreState {
  const next: PartialStoreState = {
    sessionId: state.sessionId,
    turns: state.turns,
    items: { ...state.items },
    rawEvents: [...state.rawEvents, envelope],
    errors: state.errors,
    pendingApprovals: state.pendingApprovals,
  }
  applyEvent(next, envelope.event)
  return next
}

function applyEvent(next: PartialStoreState, event: AgentEvent) {
  if ('sessionId' in event && event.sessionId && !next.sessionId) {
    next.sessionId = event.sessionId
  }

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

    case 'approval.requested': {
      next.pendingApprovals = [
        ...next.pendingApprovals,
        {
          approvalId: event.request.approvalId,
          itemId: event.itemId,
          toolName: event.request.toolName,
          input: event.request.input,
          risk: event.request.risk,
          reason: event.request.reason,
          createdAt: event.timestamp,
        },
      ]
      break
    }

    case 'approval.decided': {
      next.pendingApprovals = next.pendingApprovals.filter(
        (p) => p.approvalId !== event.approvalId,
      )
      break
    }

    case 'turn.finished': {
      next.turns = next.turns.map((t) =>
        t.id === event.turnId
          ? { ...t, status: event.status, stats: event.stats, finishedAt: event.timestamp }
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
