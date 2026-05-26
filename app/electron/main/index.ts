import { app, BrowserWindow, dialog, ipcMain, nativeImage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { config as loadEnv } from 'dotenv'
import {
  getSettings,
  getPublicSettings,
  setSettings,
  bootstrapFromEnv,
} from './settings'
import type { AnvilSettings } from '../shared/settings'
import type { QueryRequest, SessionMeta, ApprovalDecision } from '../shared/session'
import type { ConfirmRequest, ConfirmResponse } from '../shared/dialog'
import type { AgentEventEnvelope, ApprovalRequest, AgentEvent } from '../shared/events'
import { createAdapter } from './sdkAdapter'
import {
  initDb,
  appendEvent,
  upsertSession,
  listSessions,
  getSession,
  getLatestSession,
  getSessionEvents,
  deleteSession,
} from './db'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')
loadEnv({ path: path.join(projectRoot, '.env.local') })
loadEnv({ path: path.join(projectRoot, '.env') })
bootstrapFromEnv()

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null

const pendingApprovals = new Map<
  string,
  (decision: { behavior: 'allow' | 'deny'; updatedInput?: unknown; message?: string }) => void
>()

type FailureSource =
  | { kind: 'user-cancel' }
  | { kind: 'first-response-timeout'; afterMs: number }
  | { kind: 'idle-timeout'; afterMs: number }
  | { kind: 'hard-timeout'; afterMs: number }
  | { kind: 'api-error' }

interface ActiveQuery {
  abort: AbortController
  failure: FailureSource | null
  finishFailed: (source: FailureSource, normalized?: NormalizedError) => void
}

let activeQuery: ActiveQuery | null = null
let queryInFlight = false

const FIRST_RESPONSE_TIMEOUT_MS = 15_000
const STREAM_IDLE_TIMEOUT_MS = 30_000
const HARD_TIMEOUT_MS = 5 * 60 * 1000

interface NormalizedError {
  status?: number
  code?: string | number
  message: string
  hint: string
  raw: unknown
}

function normalizeError(err: any): NormalizedError {
  const status: number | undefined =
    err?.status ?? err?.statusCode ?? err?.response?.status ?? err?.cause?.status
  const code = err?.code ?? err?.cause?.code
  const message =
    err?.response?.data?.error?.message ??
    err?.response?.data?.message ??
    err?.body?.error?.message ??
    err?.message ??
    String(err)

  let hint = ''
  if (status === 401 || status === 403) {
    hint = 'API Key 无效、无权限，或额度/账号权限不足'
  } else if (status === 400) {
    hint = '请求参数错误，可能 model / baseUrl / provider 协议不兼容'
  } else if (status === 404) {
    hint = 'endpoint 或 model 不存在'
  } else if (status === 429) {
    hint = '请求过于频繁或额度受限'
  } else if (status && status >= 500) {
    hint = '上游服务错误（5xx）'
  } else if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    hint = '无法连接到 endpoint，请检查 baseUrl / 网络 / 代理'
  } else if (code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    hint = '证书校验失败，请检查 endpoint TLS 配置'
  }

  return { status, code, message, hint, raw: err }
}

function describeFailure(source: FailureSource, normalized?: NormalizedError): string {
  switch (source.kind) {
    case 'user-cancel':
      return '请求已取消'
    case 'first-response-timeout':
      return `上游 ${source.afterMs / 1000}s 内无响应（first response timeout）。可能是 baseUrl / API key / model 配置错误或服务端无响应`
    case 'idle-timeout':
      return `已开始流式响应但 ${source.afterMs / 1000}s 内无新事件（stream idle timeout）`
    case 'hard-timeout':
      return `请求超过最大执行时长 ${source.afterMs / 1000}s（hard timeout）`
    case 'api-error': {
      const parts: string[] = []
      if (normalized?.status) parts.push(`HTTP ${normalized.status}`)
      if (normalized?.code) parts.push(`code=${normalized.code}`)
      const prefix = parts.length > 0 ? `[${parts.join(' · ')}] ` : ''
      const hint = normalized?.hint ? ` —— ${normalized.hint}` : ''
      return `${prefix}${normalized?.message ?? 'API error'}${hint}`
    }
  }
}

function createWindow() {
  const iconPath = path.join(projectRoot, 'build', 'icon.png')
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    ...(icon ? { icon } : {}),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  initDb()

  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(projectRoot, 'build', 'icon.png')
    if (fs.existsSync(iconPath)) {
      try {
        const icon = nativeImage.createFromPath(iconPath)
        app.dock.setIcon(icon)
      } catch (err) {
        console.error('Failed to set macOS dock icon:', err)
      }
    }
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('settings:get', () => getPublicSettings())
ipcMain.handle('settings:set', (_e, patch: Partial<AnvilSettings>) => setSettings(patch))

ipcMain.handle('sessions:list', (_e, workspacePath?: string) => listSessions(workspacePath))
ipcMain.handle('sessions:get', (_e, sessionId: string) => getSession(sessionId))
ipcMain.handle('sessions:latest', (_e, workspacePath?: string) => getLatestSession(workspacePath))
ipcMain.handle('sessions:events', (_e, sessionId: string) => getSessionEvents(sessionId))
ipcMain.handle('sessions:delete', (_e, sessionId: string) => {
  deleteSession(sessionId)
  return { ok: true }
})

ipcMain.handle('agent:cancel', () => {
  if (activeQuery) {
    activeQuery.finishFailed({ kind: 'user-cancel' })
    return { ok: true }
  }
  return { ok: false, error: 'no active query' }
})

ipcMain.handle(
  'dialog:confirm',
  async (_e, req: ConfirmRequest): Promise<ConfirmResponse> => {
    const options: Electron.MessageBoxOptions = {
      type: req.destructive ? 'warning' : 'question',
      title: req.title,
      message: req.message,
      detail: req.detail,
      buttons: [req.confirmLabel ?? '确认', req.cancelLabel ?? '取消'],
      defaultId: req.destructive ? 1 : 0,
      cancelId: 1,
      noLink: true,
    }
    const result = mainWindow
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options)
    return { confirmed: result.response === 0 }
  },
)

ipcMain.handle('approval:decide', (_e, decision: ApprovalDecision) => {
  const resolver = pendingApprovals.get(decision.approvalId)
  if (!resolver) return { ok: false, error: 'approval not found' }
  pendingApprovals.delete(decision.approvalId)
  resolver({
    behavior: decision.decision,
    message: decision.reason,
  })
  return { ok: true }
})

ipcMain.handle('agent:query', async (_event, req: QueryRequest) => {
  if (queryInFlight || activeQuery) {
    return { ok: false, error: '已有任务正在运行，请等待结束或取消后再发起' }
  }
  queryInFlight = true

  try {
    return await runAgentQuery(req)
  } finally {
    queryInFlight = false
  }
})

async function runAgentQuery(req: QueryRequest) {
  const { query } = await import('@anthropic-ai/claude-agent-sdk')
  const settings = getSettings()

  if (!settings.apiKey) {
    throw new Error('API Key 未配置，请在 Settings 里填写')
  }

  process.env.ANTHROPIC_BASE_URL = settings.baseUrl
  process.env.ANTHROPIC_API_KEY = settings.apiKey

  const adapter = createAdapter()
  adapter.start()
  let sessionId: string | null = null
  let firstAssistantText = ''

  function sendEnvelope(env: AgentEventEnvelope) {
    mainWindow?.webContents.send('agent:event', env)

    if ('sessionId' in env.event && env.event.sessionId) {
      const newId = env.event.sessionId
      if (!sessionId) {
        sessionId = newId
        const now = new Date().toISOString()
        const existing = getSession(sessionId)
        if (!existing) {
          upsertSession({
            id: sessionId,
            workspacePath: settings.workspacePath,
            title: req.prompt.slice(0, 60) || 'untitled',
            firstPrompt: req.prompt,
            createdAt: now,
            updatedAt: now,
            lastStatus: 'running',
            turnCount: 0,
            totalCostUsd: 0,
          })
        }
      }
    }

    if (sessionId) {
      try {
        appendEvent(env)
      } catch (e) {
        console.error('[db] appendEvent failed:', e)
      }
    }

    if (env.event.type === 'text.delta' && !firstAssistantText) {
      firstAssistantText = (env.event as any).text?.slice(0, 80) ?? ''
    }
  }

  const abortController = new AbortController()
  let receivedAnyMessage = false
  let alreadyFinished = false

  function finishFailed(source: FailureSource, normalized?: NormalizedError) {
    if (alreadyFinished) return
    alreadyFinished = true
    if (!query_state.failure) query_state.failure = source

    const message = describeFailure(source, normalized)
    const status: 'cancelled' | 'failed' = source.kind === 'user-cancel' ? 'cancelled' : 'failed'

    try {
      sendEnvelope(adapter.fail(message))
      sendEnvelope(adapter.finish(status))
    } catch (e) {
      console.error('[finishFailed] send envelope failed:', e)
    }

    if (sessionId) {
      try {
        const now = new Date().toISOString()
        const existing = getSession(sessionId)
        if (existing) {
          upsertSession({ ...existing, updatedAt: now, lastStatus: status })
        }
      } catch (e) {
        console.error('[finishFailed] db update failed:', e)
      }
    }

    try {
      abortController.abort()
    } catch {}
  }

  const query_state: ActiveQuery = { abort: abortController, failure: null, finishFailed }
  activeQuery = query_state

  const firstResponseTimer = setTimeout(() => {
    if (!receivedAnyMessage && !alreadyFinished) {
      finishFailed({ kind: 'first-response-timeout', afterMs: FIRST_RESPONSE_TIMEOUT_MS })
    }
  }, FIRST_RESPONSE_TIMEOUT_MS)

  let idleTimer: NodeJS.Timeout | null = null
  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      if (!alreadyFinished) {
        finishFailed({ kind: 'idle-timeout', afterMs: STREAM_IDLE_TIMEOUT_MS })
      }
    }, STREAM_IDLE_TIMEOUT_MS)
  }

  const hardTimer = setTimeout(() => {
    if (!alreadyFinished) {
      finishFailed({ kind: 'hard-timeout', afterMs: HARD_TIMEOUT_MS })
    }
  }, HARD_TIMEOUT_MS)

  const options: any = {
    cwd: settings.workspacePath,
    abortController,
    canUseTool: async (toolName: string, input: any) => {
      const approvalId = randomUUID()
      const risk = toolRisk(toolName)
      const request: ApprovalRequest = { approvalId, toolName, input, risk }
      const turnId = adapter.getTurnId()
      const event: AgentEvent = {
        type: 'approval.requested',
        sessionId: sessionId ?? '',
        turnId,
        itemId: `approval:${approvalId}`,
        request,
        seq: adapter.nextSeq(),
        timestamp: new Date().toISOString(),
      }
      sendEnvelope({ event })

      const decision = await new Promise<{
        behavior: 'allow' | 'deny'
        updatedInput?: unknown
        message?: string
      }>((resolve) => {
        pendingApprovals.set(approvalId, resolve)
      })

      const decidedEvent: AgentEvent = {
        type: 'approval.decided',
        sessionId: sessionId ?? '',
        turnId,
        approvalId,
        decision: decision.behavior,
        reason: decision.message,
        seq: adapter.nextSeq(),
        timestamp: new Date().toISOString(),
      }
      sendEnvelope({ event: decidedEvent })

      if (decision.behavior === 'allow') {
        return { behavior: 'allow', updatedInput: decision.updatedInput ?? input }
      }
      return { behavior: 'deny', message: decision.message ?? 'User denied tool use' }
    },
  }

  if (settings.model) options.model = settings.model
  if (req.mode === 'continue') options.continue = true
  if (req.mode === 'resume') options.resume = req.sessionId

  if (settings.stitchProjectId) {
    options.mcpServers = {
      stitch: {
        command: 'npx',
        args: ['-y', '@_davideast/stitch-mcp', 'proxy'],
        env: {
          STITCH_PROJECT_ID: settings.stitchProjectId,
          ...process.env,
        },
      },
    }
  }

  try {
    const q = query({ prompt: req.prompt, options })
    let terminalResultStatus: 'completed' | 'failed' | null = null
    let terminalResultError: string | null = null
    for await (const msg of q) {
      const rawType = (msg as any)?.type
      const isMeaningful =
        rawType === 'assistant' ||
        rawType === 'user' ||
        rawType === 'result'

      if (isMeaningful && !receivedAnyMessage) {
        receivedAnyMessage = true
        clearTimeout(firstResponseTimer)
      }
      if (isMeaningful) resetIdleTimer()

      const envelopes = adapter.ingest(msg)
      for (const env of envelopes) sendEnvelope(env)

      if (rawType === 'result') {
        terminalResultStatus = (msg as any)?.is_error ? 'failed' : 'completed'
        terminalResultError =
          typeof (msg as any)?.result === 'string' && (msg as any).result
            ? (msg as any).result
            : null
        break
      }

      if (alreadyFinished || query_state.failure) break
    }

    if (alreadyFinished || query_state.failure) {
      const source = query_state.failure ?? { kind: 'api-error' as const }
      if (!alreadyFinished) finishFailed(source)
      return { ok: false, error: describeFailure(source), sessionId }
    }

    if (sessionId) {
      const now = new Date().toISOString()
      const existing = getSession(sessionId)
      const lastStatus = terminalResultStatus ?? 'completed'
      const meta: SessionMeta = existing
        ? {
            ...existing,
            updatedAt: now,
            lastStatus,
            turnCount: existing.turnCount + 1,
          }
        : {
            id: sessionId,
            workspacePath: settings.workspacePath,
            title: req.prompt.slice(0, 60),
            firstPrompt: req.prompt,
            createdAt: now,
            updatedAt: now,
            lastStatus,
            turnCount: 1,
            totalCostUsd: 0,
          }
      upsertSession(meta)
    }

    if (terminalResultStatus === 'failed') {
      return { ok: false, error: terminalResultError ?? '上游返回失败结果', sessionId }
    }

    return { ok: true, sessionId }
  } catch (err: any) {
    const source: FailureSource = query_state.failure ?? { kind: 'api-error' }
    const normalized: NormalizedError | undefined =
      source.kind === 'api-error' ? normalizeError(err) : undefined
    const message = describeFailure(source, normalized)

    finishFailed(source, normalized)

    return { ok: false, error: message, sessionId }
  } finally {
    clearTimeout(firstResponseTimer)
    if (idleTimer) clearTimeout(idleTimer)
    clearTimeout(hardTimer)
    if (activeQuery === query_state) activeQuery = null
  }
}

function toolRisk(toolName: string): 'low' | 'medium' | 'high' {
  if (/^(Read|Glob|Grep|LS|WebFetch|WebSearch)$/i.test(toolName)) return 'low'
  if (/^(Bash|Edit|Write|MultiEdit|NotebookEdit)$/i.test(toolName)) return 'high'
  if (toolName.startsWith('mcp__')) return 'medium'
  return 'medium'
}
