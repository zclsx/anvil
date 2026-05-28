import { randomUUID } from 'node:crypto'
import type { IpcMain } from 'electron'
import { getSettings } from '../settings'
import { appendEvent, getSession, upsertSession } from '../db'
import { createAdapter } from '../sdkAdapter'
import type { QueryRequest, SessionMeta } from '../../shared/session'
import type { AgentEvent, AgentEventEnvelope, ApprovalRequest } from '../../shared/events'
import {
  type ActiveQuery,
  type FailureSource,
  type NormalizedError,
  FIRST_RESPONSE_TIMEOUT_MS,
  HARD_TIMEOUT_MS,
  STREAM_IDLE_TIMEOUT_MS,
  describeFailure,
  normalizeError,
} from '../query/errors'
import { resolveQueryWorkspace } from '../query/workspace'
import { getClaudeExecutablePath } from '../query/claudeExecutable'
import { toolRisk } from '../query/toolRisk'
import type { MainRuntimeContext } from '../runtimeContext'

export function registerAgentIpc(ipcMain: IpcMain, ctx: MainRuntimeContext): void {
  ipcMain.handle('agent:cancel', () => {
    if (ctx.activeQuery) {
      ctx.activeQuery.finishFailed({ kind: 'user-cancel' })
      return { ok: true }
    }
    return { ok: false, error: 'no active query' }
  })

  ipcMain.handle('agent:query', async (_event, req: QueryRequest) => {
    if (ctx.queryInFlight || ctx.activeQuery) {
      return { ok: false, error: '已有任务正在运行，请等待结束或取消后再发起' }
    }
    ctx.queryInFlight = true

    try {
      return await runAgentQuery(req, ctx)
    } finally {
      ctx.queryInFlight = false
    }
  })
}

async function runAgentQuery(req: QueryRequest, ctx: MainRuntimeContext) {
  const { query } = await import('@anthropic-ai/claude-agent-sdk')
  const settings = getSettings()
  const workspacePath = resolveQueryWorkspace(req)

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
    ctx.mainWindow?.webContents.send('agent:event', env)

    if ('sessionId' in env.event && env.event.sessionId) {
      const newId = env.event.sessionId
      if (!sessionId) {
        sessionId = newId
        const now = new Date().toISOString()
        const existing = getSession(sessionId)
        if (!existing) {
          upsertSession({
            id: sessionId,
            workspacePath,
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
  ctx.activeQuery = query_state

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
    cwd: workspacePath,
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
        ctx.pendingApprovals.set(approvalId, resolve)
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
  const claudeExecutablePath = getClaudeExecutablePath()
  if (claudeExecutablePath) {
    options.pathToClaudeCodeExecutable = claudeExecutablePath
  }

  if (settings.model) options.model = settings.model
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
            workspacePath,
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
    if (ctx.activeQuery === query_state) ctx.activeQuery = null
  }
}
