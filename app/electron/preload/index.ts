import { contextBridge, ipcRenderer } from 'electron'
import type { AnvilSettings, PublicSettings } from '../shared/settings'
import type { AgentEventEnvelope } from '../shared/events'
import type { SessionMeta, ApprovalDecision, QueryRequest } from '../shared/session'
import type { ConfirmRequest, ConfirmResponse } from '../shared/dialog'

const anvil = {
  settings: {
    get: (): Promise<PublicSettings> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<AnvilSettings>): Promise<PublicSettings> =>
      ipcRenderer.invoke('settings:set', patch),
  },

  sessions: {
    list: (workspacePath?: string): Promise<SessionMeta[]> =>
      ipcRenderer.invoke('sessions:list', workspacePath),
    get: (sessionId: string): Promise<SessionMeta | null> =>
      ipcRenderer.invoke('sessions:get', sessionId),
    latest: (workspacePath?: string): Promise<SessionMeta | null> =>
      ipcRenderer.invoke('sessions:latest', workspacePath),
    events: (sessionId: string): Promise<AgentEventEnvelope[]> =>
      ipcRenderer.invoke('sessions:events', sessionId),
    delete: (sessionId: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('sessions:delete', sessionId),
  },

  query: (req: QueryRequest): Promise<{ ok: boolean; sessionId?: string | null; error?: string }> =>
    ipcRenderer.invoke('agent:query', req),

  cancel: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('agent:cancel'),

  approval: {
    decide: (decision: ApprovalDecision): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('approval:decide', decision),
  },

  dialog: {
    confirm: (req: ConfirmRequest): Promise<ConfirmResponse> =>
      ipcRenderer.invoke('dialog:confirm', req),
  },

  onAgentEvent: (callback: (envelope: AgentEventEnvelope) => void) => {
    const listener = (_e: unknown, envelope: AgentEventEnvelope) => callback(envelope)
    ipcRenderer.on('agent:event', listener)
    return () => ipcRenderer.off('agent:event', listener)
  },
}

contextBridge.exposeInMainWorld('anvil', anvil)

export type AnvilApi = typeof anvil
