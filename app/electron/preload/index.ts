import { contextBridge, ipcRenderer } from 'electron'
import type { AnvilSettings, PublicSettings } from '../shared/settings'
import type { AgentEventEnvelope } from '../shared/events'

const anvil = {
  settings: {
    get: (): Promise<PublicSettings> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<AnvilSettings>): Promise<PublicSettings> =>
      ipcRenderer.invoke('settings:set', patch),
  },

  query: (args: { prompt: string }) => ipcRenderer.invoke('agent:query', args),

  onAgentEvent: (callback: (envelope: AgentEventEnvelope) => void) => {
    const listener = (_e: unknown, envelope: AgentEventEnvelope) => callback(envelope)
    ipcRenderer.on('agent:event', listener)
    return () => ipcRenderer.off('agent:event', listener)
  },
}

contextBridge.exposeInMainWorld('anvil', anvil)

export type AnvilApi = typeof anvil
