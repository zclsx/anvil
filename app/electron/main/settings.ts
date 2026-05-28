import Store from 'electron-store'
import { app } from 'electron'
import os from 'node:os'
import path from 'node:path'
import type { AnvilSettings, PublicSettings } from '../shared/settings'

export type { AnvilSettings, PublicSettings }

const defaults: AnvilSettings = {
  baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
  apiKey: '',
  model: 'mimo-v2.5-pro',
  stitchProjectId: '',
  workspacePath: '',
}

interface StoreSchema extends AnvilSettings {
  hasUserConfigured: boolean
}

const store = new Store<StoreSchema>({
  name: 'anvil-settings',
  defaults: { ...defaults, hasUserConfigured: false },
  schema: {
    baseUrl: { type: 'string' },
    apiKey: { type: 'string' },
    model: { type: 'string' },
    stitchProjectId: { type: 'string' },
    workspacePath: { type: 'string' },
    hasUserConfigured: { type: 'boolean' },
  },
})

function resolveWorkspacePath(stored: string): string {
  if (stored && stored.length > 0) return normalizeWorkspacePathValue(stored)
  try {
    return app.getPath('home')
  } catch {
    return process.cwd()
  }
}

function normalizeWorkspacePathValue(value: string): string {
  let trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed === '~' || trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    trimmed = path.join(os.homedir(), trimmed.slice(1))
  }
  return path.resolve(trimmed)
}

function getRawSettings(): AnvilSettings {
  return {
    baseUrl: store.get('baseUrl'),
    apiKey: store.get('apiKey'),
    model: store.get('model'),
    stitchProjectId: store.get('stitchProjectId') || '',
    workspacePath: resolveWorkspacePath(store.get('workspacePath') || ''),
  }
}

export function getSettings(): AnvilSettings {
  return getRawSettings()
}

export function getPublicSettings(): PublicSettings {
  const storedWorkspacePath = store.get('workspacePath') || ''
  const raw = getRawSettings()
  const apiKey = raw.apiKey
  return {
    baseUrl: raw.baseUrl,
    hasApiKey: apiKey.length > 0,
    apiKeyHint: apiKey.length > 8 ? `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}` : '',
    model: raw.model,
    stitchProjectId: raw.stitchProjectId,
    workspacePath: raw.workspacePath,
    hasWorkspacePath: storedWorkspacePath.trim().length > 0,
    source: store.get('hasUserConfigured') ? 'user' : raw.apiKey ? 'env' : 'default',
  }
}

export function setSettings(patch: Partial<AnvilSettings>): PublicSettings {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    const value = k === 'workspacePath' && typeof v === 'string'
      ? normalizeWorkspacePathValue(v)
      : v
    store.set(k as keyof AnvilSettings, value)
  }
  store.set('hasUserConfigured', true)
  return getPublicSettings()
}

export function bootstrapFromEnv() {
  const hasUserConfigured = store.get('hasUserConfigured')
  if (hasUserConfigured) return

  const envBaseUrl = process.env.ANVIL_DEV_BASE_URL
  const envApiKey = process.env.ANVIL_DEV_API_KEY
  const envModel = process.env.ANVIL_DEV_MODEL
  const envStitchProjectId = process.env.ANVIL_DEV_STITCH_PROJECT_ID
  const envWorkspace = process.env.ANVIL_DEV_WORKSPACE_PATH

  const applied: string[] = []
  if (envBaseUrl) { store.set('baseUrl', envBaseUrl); applied.push('baseUrl') }
  if (envApiKey) { store.set('apiKey', envApiKey); applied.push('apiKey') }
  if (envModel) { store.set('model', envModel); applied.push('model') }
  if (envStitchProjectId) { store.set('stitchProjectId', envStitchProjectId); applied.push('stitchProjectId') }
  if (envWorkspace) { store.set('workspacePath', normalizeWorkspacePathValue(envWorkspace)); applied.push('workspacePath') }

  if (applied.length > 0) {
    console.log('[settings] bootstrapped from .env.local:', applied.join(', '))
  }
}

export function getSettingsPath(): string {
  return store.path
}
