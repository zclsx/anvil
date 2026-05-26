import { contextBridge, ipcRenderer } from 'electron'

export interface AnvilSettings {
  baseUrl: string
  apiKey: string
  model: string
}

const anvil = {
  settings: {
    get: (): Promise<AnvilSettings> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<AnvilSettings>): Promise<AnvilSettings> =>
      ipcRenderer.invoke('settings:set', patch),
  },

  query: (args: { prompt: string }) => ipcRenderer.invoke('agent:query', args),

  onMessage: (callback: (msg: unknown) => void) => {
    const listener = (_e: unknown, msg: unknown) => callback(msg)
    ipcRenderer.on('agent:message', listener)
    return () => ipcRenderer.off('agent:message', listener)
  },
}

contextBridge.exposeInMainWorld('anvil', anvil)

export type AnvilApi = typeof anvil
