import { randomUUID } from 'node:crypto'
import { app, type IpcMain } from 'electron'
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
import { loadLocalMcpServers } from '../query/localMcpServers'
import { updateToolIdleState } from '../query/toolIdleTimer'
import type { MainRuntimeContext } from '../runtimeContext'

const READ_DOCUMENT_TOOL_NAME = 'mcp__anvil__read_document'
const GET_DOCUMENT_SKILL_TOOL_NAME = 'mcp__anvil__get_document_skill'
const OFFICE_DOCUMENT_GUIDANCE =
  'When the user references Microsoft Office documents (.docx Word or .xlsx Excel files) by path, ' +
  'read their contents using the read_document tool from the "anvil" MCP server. ' +
  'When the user asks you to generate or export a plain Word document, use the create_docx tool. ' +
  'When the user wants a formal/report document, a PRD, meeting notes, or asks to follow a document ' +
  'skill/template (e.g. "default-report"), first call get_document_skill to read its writing rules, ' +
  'then call create_docx_from_skill with markdown that follows those rules. ' +
  'Do NOT use Bash, python, pip, or pandoc to parse or produce Office documents.'

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
  const { query, createSdkMcpServer } = await import('@anthropic-ai/claude-agent-sdk')
  const { createReadDocumentTool, createWriteDocumentTool } = await import('../query/documentTool')
  const { createGetDocumentSkillTool, createWriteFromSkillTool } = await import('../query/documentSkillTool')
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
  let sentUserPromptEcho = false
  const visiblePrompt = req.displayPrompt ?? req.prompt

  function createUserPromptEchoEvents(turn: Extract<AgentEvent, { type: 'turn.started' }>): AgentEventEnvelope[] {
    const itemId = `user:${turn.turnId}`
    const timestamp = new Date().toISOString()
    return [
      {
        event: {
          type: 'item.added',
          sessionId: turn.sessionId,
          turnId: turn.turnId,
          itemId,
          role: 'user',
          kind: 'text',
          seq: adapter.nextSeq(),
          timestamp,
        },
      },
      {
        event: {
          type: 'text.delta',
          sessionId: turn.sessionId,
          turnId: turn.turnId,
          itemId,
          text: visiblePrompt,
          seq: adapter.nextSeq(),
          timestamp,
        },
      },
    ]
  }

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
            title: visiblePrompt.slice(0, 60) || 'untitled',
            firstPrompt: visiblePrompt,
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
  let pendingApprovalCount = 0
  let activeToolCount = 0

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
    if (pendingApprovalCount > 0 || activeToolCount > 0) return
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      if (!alreadyFinished) {
        finishFailed({ kind: 'idle-timeout', afterMs: STREAM_IDLE_TIMEOUT_MS })
      }
    }, STREAM_IDLE_TIMEOUT_MS)
  }

  let hardTimer: NodeJS.Timeout | null = null
  let hardRemainingMs = HARD_TIMEOUT_MS
  let hardStartedAt = Date.now()
  function startHardTimer() {
    hardStartedAt = Date.now()
    hardTimer = setTimeout(() => {
      if (!alreadyFinished) {
        finishFailed({ kind: 'hard-timeout', afterMs: HARD_TIMEOUT_MS })
      }
    }, hardRemainingMs)
  }
  startHardTimer()

  function pauseTimersForApproval() {
    if (pendingApprovalCount === 0) {
      if (idleTimer) {
        clearTimeout(idleTimer)
        idleTimer = null
      }
      if (hardTimer) {
        clearTimeout(hardTimer)
        hardTimer = null
        hardRemainingMs = Math.max(0, hardRemainingMs - (Date.now() - hardStartedAt))
      }
    }
    pendingApprovalCount++
  }
  function resumeTimersAfterApproval() {
    pendingApprovalCount = Math.max(0, pendingApprovalCount - 1)
    if (pendingApprovalCount === 0 && !alreadyFinished) {
      if (activeToolCount === 0) resetIdleTimer()
      startHardTimer()
    }
  }

  function pauseIdleForTool() {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  function applyToolIdleEvent(event: AgentEvent) {
    const transition = updateToolIdleState(
      activeToolCount,
      event,
      pendingApprovalCount === 0 && !alreadyFinished,
    )
    activeToolCount = transition.activeToolCount
    if (transition.clearIdleTimer) pauseIdleForTool()
    if (transition.resetIdleTimer) resetIdleTimer()
  }

  const options: any = {
    cwd: workspacePath,
    abortController,
    canUseTool: async (toolName: string, input: any) => {
      if (toolName === READ_DOCUMENT_TOOL_NAME || toolName === GET_DOCUMENT_SKILL_TOOL_NAME) {
        return { behavior: 'allow', updatedInput: input }
      }
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

      pauseTimersForApproval()
      let decision: { behavior: 'allow' | 'deny'; updatedInput?: unknown; message?: string }
      try {
        decision = await new Promise<{
          behavior: 'allow' | 'deny'
          updatedInput?: unknown
          message?: string
        }>((resolve) => {
          ctx.pendingApprovals.set(approvalId, resolve)
        })
      } finally {
        resumeTimersAfterApproval()
      }

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

  options.systemPrompt = {
    type: 'preset',
    preset: 'claude_code',
    append: OFFICE_DOCUMENT_GUIDANCE,
  }

  const referencedPaths = req.referencedPaths ?? []
  const mcpServers: Record<string, any> = {
    anvil: createSdkMcpServer({
      name: 'anvil',
      version: app.getVersion(),
      tools: [
        createReadDocumentTool(() => workspacePath, () => referencedPaths),
        createWriteDocumentTool(() => workspacePath),
        createGetDocumentSkillTool(() => workspacePath),
        createWriteFromSkillTool(() => workspacePath),
      ],
      alwaysLoad: true,
    }),
  }
  Object.assign(mcpServers, await loadLocalMcpServers())
  options.mcpServers = mcpServers

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
      for (const env of envelopes) {
        sendEnvelope(env)
        applyToolIdleEvent(env.event)
        if (env.event.type === 'turn.started' && !sentUserPromptEcho) {
          sentUserPromptEcho = true
          for (const userEnv of createUserPromptEchoEvents(env.event)) {
            sendEnvelope(userEnv)
          }
        }
      }

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
            title: visiblePrompt.slice(0, 60),
            firstPrompt: visiblePrompt,
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
    if (hardTimer) clearTimeout(hardTimer)
    if (ctx.activeQuery === query_state) ctx.activeQuery = null
  }
}
