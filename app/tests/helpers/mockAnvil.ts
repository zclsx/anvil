import type { Page } from '@playwright/test'

export type MockAnvilOptions = {
  settings?: {
    hasApiKey?: boolean
    workspacePath?: string
    baseUrl?: string
    model?: string
    stitchProjectId?: string
    source?: 'user' | 'env' | 'default'
    apiKeyHint?: string
  }
  sessions?: Array<{
    id: string
    workspacePath: string
    title: string
    firstPrompt: string
    createdAt: string
    updatedAt: string
    lastStatus: 'running' | 'completed' | 'failed' | 'cancelled' | 'unknown'
    turnCount: number
    totalCostUsd: number
  }>
  workspaceExists?: boolean
  pickedDirectory?: string | null
  confirmResponse?: boolean
  queryResult?: { ok: boolean; sessionId?: string | null; error?: string }
  queryDelayMs?: number
  filePathsForDrop?: string[]
}

declare global {
  interface Window {
    __anvilTestControl?: {
      emitEvent: (envelope: unknown) => void
      getCalls: (channel: string) => unknown[]
      setOption: <K extends keyof MockAnvilOptions>(key: K, value: MockAnvilOptions[K]) => void
    }
  }
}

export async function setupMockAnvil(page: Page, options: MockAnvilOptions = {}): Promise<void> {
  await page.addInitScript((initOptions: MockAnvilOptions) => {
    const calls: Record<string, unknown[]> = {}
    const listeners: Array<(envelope: unknown) => void> = []
    const opts = { ...initOptions }

    function record(channel: string, args: unknown) {
      ;(calls[channel] ??= []).push(args)
    }

    const defaultSettings = {
      baseUrl: 'https://example.com',
      hasApiKey: true,
      apiKeyHint: 'sk-…1234',
      model: 'test-model',
      stitchProjectId: '',
      workspacePath: '/Users/test',
      source: 'user' as const,
      ...(opts.settings ?? {}),
    }

    const anvil = {
      settings: {
        get: async () => {
          record('settings:get', null)
          return defaultSettings
        },
        set: async (patch: Record<string, unknown>) => {
          record('settings:set', patch)
          Object.assign(defaultSettings, patch)
          return defaultSettings
        },
      },
      sessions: {
        list: async (workspacePath?: string) => {
          record('sessions:list', workspacePath)
          return opts.sessions ?? []
        },
        get: async (sessionId: string) => {
          record('sessions:get', sessionId)
          return (opts.sessions ?? []).find((s) => s.id === sessionId) ?? null
        },
        latest: async (workspacePath?: string) => {
          record('sessions:latest', workspacePath)
          return (opts.sessions ?? [])[0] ?? null
        },
        events: async (sessionId: string) => {
          record('sessions:events', sessionId)
          return []
        },
        delete: async (sessionId: string) => {
          record('sessions:delete', sessionId)
          return { ok: true }
        },
        workspaceExists: async (workspacePath: string) => {
          record('sessions:workspace-exists', workspacePath)
          return { exists: opts.workspaceExists !== false }
        },
        setWorkspace: async (sessionId: string, workspacePath: string) => {
          record('sessions:set-workspace', { sessionId, workspacePath })
          return { ok: true }
        },
      },
      query: async (req: unknown) => {
        record('agent:query', req)
        if (opts.queryDelayMs) {
          await new Promise((r) => setTimeout(r, opts.queryDelayMs))
        }
        return opts.queryResult ?? { ok: true, sessionId: 'test-session-id' }
      },
      cancel: async () => {
        record('agent:cancel', null)
        return { ok: true }
      },
      approval: {
        decide: async (decision: unknown) => {
          record('approval:decide', decision)
          return { ok: true }
        },
      },
      dialog: {
        confirm: async (req: unknown) => {
          record('dialog:confirm', req)
          return { confirmed: opts.confirmResponse !== false }
        },
        pickDirectory: async (req: unknown) => {
          record('dialog:pickDirectory', req)
          if (opts.pickedDirectory === null) {
            return { canceled: true, path: null }
          }
          return {
            canceled: false,
            path: opts.pickedDirectory ?? '/Users/test/picked',
          }
        },
      },
      updates: {
        get: async () => {
          record('updates:get', null)
          return { status: 'idle', currentVersion: '0.0.0-test' }
        },
        check: async () => ({ ok: true }),
        download: async () => ({ ok: true }),
        install: async () => ({ ok: true }),
        onStatus: (callback: (snapshot: unknown) => void) => {
          record('updates:onStatus', null)
          return () => {
            void callback
          }
        },
      },
      files: {
        getPaths: (_files: File[]) => {
          record('files:getPaths', null)
          return opts.filePathsForDrop ?? []
        },
      },
      onAgentEvent: (callback: (envelope: unknown) => void) => {
        listeners.push(callback)
        return () => {
          const idx = listeners.indexOf(callback)
          if (idx >= 0) listeners.splice(idx, 1)
        }
      },
    }

    ;(window as unknown as { anvil: typeof anvil }).anvil = anvil
    ;(window as unknown as { __anvilTestControl: unknown }).__anvilTestControl = {
      emitEvent: (envelope: unknown) => {
        for (const listener of listeners) listener(envelope)
      },
      getCalls: (channel: string) => calls[channel] ?? [],
      setOption: <K extends keyof MockAnvilOptions>(key: K, value: MockAnvilOptions[K]) => {
        opts[key] = value
      },
    }
  }, options)
}
