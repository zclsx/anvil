import Store from 'electron-store'

export interface AnvilSettings {
  baseUrl: string
  apiKey: string
  model: string
}

const defaults: AnvilSettings = {
  baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
  apiKey: '',
  model: 'mimo-v2.5-pro',
}

const store = new Store<AnvilSettings>({
  name: 'anvil-settings',
  defaults,
  schema: {
    baseUrl: { type: 'string' },
    apiKey: { type: 'string' },
    model: { type: 'string' },
  },
})

export function getSettings(): AnvilSettings {
  return {
    baseUrl: store.get('baseUrl'),
    apiKey: store.get('apiKey'),
    model: store.get('model'),
  }
}

export function setSettings(patch: Partial<AnvilSettings>): AnvilSettings {
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) store.set(k as keyof AnvilSettings, v)
  }
  return getSettings()
}

export function getSettingsPath(): string {
  return store.path
}
