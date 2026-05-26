import { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { History, FileSearch, Plus, RotateCw, Shield, AlertCircle, Trash2 } from 'lucide-react'
import { useAgentStore, type Item, type PendingApproval } from './store'
import type { AnvilSettings, PublicSettings } from '../electron/shared/settings'
import type { AgentEventEnvelope } from '../electron/shared/events'
import type { SessionMeta, QueryRequest } from '../electron/shared/session'
import type { ConfirmRequest, ConfirmResponse } from '../electron/shared/dialog'
import logoUrl from './assets/logo.svg'

const LogoIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <img src={logoUrl} className={className} alt="Anvil Logo" />
)

const markdownComponents: Components = {
  p: ({ node: _node, ...props }) => (
    <p className="mb-2 last:mb-0" {...props} />
  ),
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold text-primary" {...props} />
  ),
  em: ({ node: _node, ...props }) => (
    <em className="italic text-on-surface" {...props} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="my-2 list-disc pl-5" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="my-2 list-decimal pl-5" {...props} />
  ),
  li: ({ node: _node, ...props }) => (
    <li className="my-1 pl-1" {...props} />
  ),
  a: ({ node: _node, ...props }) => (
    <a className="text-[#8ab4ff] underline underline-offset-2 hover:text-primary" target="_blank" rel="noreferrer" {...props} />
  ),
  code: ({ node: _node, className, ...props }) => (
    <code className={`font-mono-code text-[0.92em] bg-surface-container-high px-1 py-0.5 rounded ${className ?? ''}`} {...props} />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre className="my-2 overflow-x-auto border border-outline-variant bg-surface-container p-3 font-mono-code text-[11px] leading-relaxed" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="my-2 border-l-2 border-outline-variant pl-3 text-on-surface-variant" {...props} />
  ),
  hr: ({ node: _node, ...props }) => (
    <hr className="my-3 border-outline-variant" {...props} />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]" {...props} />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th className="border border-outline-variant bg-surface-container px-2 py-1 text-left font-semibold" {...props} />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="border border-outline-variant px-2 py-1 align-top" {...props} />
  ),
}

type PromptMode = 'new' | 'send'

declare global {
  interface Window {
    anvil?: {
      settings: {
        get: () => Promise<PublicSettings>
        set: (patch: Partial<AnvilSettings>) => Promise<PublicSettings>
      }
      sessions: {
        list: (workspacePath?: string) => Promise<SessionMeta[]>
        get: (sessionId: string) => Promise<SessionMeta | null>
        latest: (workspacePath?: string) => Promise<SessionMeta | null>
        events: (sessionId: string) => Promise<AgentEventEnvelope[]>
        delete: (sessionId: string) => Promise<{ ok: boolean }>
      }
      query: (req: QueryRequest) => Promise<{ ok: boolean; sessionId?: string | null; error?: string }>
      cancel: () => Promise<{ ok: boolean; error?: string }>
      approval: {
        decide: (decision: {
          approvalId: string
          decision: 'allow' | 'deny'
          reason?: string
        }) => Promise<{ ok: boolean; error?: string }>
      }
      dialog: {
        confirm: (req: ConfirmRequest) => Promise<ConfirmResponse>
      }
      onAgentEvent: (callback: (envelope: AgentEventEnvelope) => void) => () => void
    }
  }
}

export function App() {
  const [prompt, setPrompt] = useState('')
  const [settings, setSettingsState] = useState<PublicSettings | null>(null)
  const [draftKey, setDraftKey] = useState('')
  const [draftBaseUrl, setDraftBaseUrl] = useState('')
  const [draftModel, setDraftModel] = useState('')
  const [draftStitchProjectId, setDraftStitchProjectId] = useState('')
  const [draftWorkspacePath, setDraftWorkspacePath] = useState('')
  const [running, setRunning] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [autoFollow, setAutoFollow] = useState(true)
  const [dismissedErrorCount, setDismissedErrorCount] = useState(0)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const loadingAnchorRef = useRef<HTMLDivElement | null>(null)
  const lastConsumedTurnIdRef = useRef<string | null>(null)

  const sessionId = useAgentStore((s) => s.sessionId)
  const turns = useAgentStore((s) => s.turns)
  const items = useAgentStore((s) => s.items)
  const rawEvents = useAgentStore((s) => s.rawEvents)
  const errors = useAgentStore((s) => s.errors)
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals)
  const sessions = useAgentStore((s) => s.sessions)
  const ingest = useAgentStore((s) => s.ingest)
  const loadFromEvents = useAgentStore((s) => s.loadFromEvents)
  const reset = useAgentStore((s) => s.reset)
  const setSessions = useAgentStore((s) => s.setSessions)
  const pushError = useAgentStore((s) => s.pushError)

  const hasAnvil = typeof window !== 'undefined' && !!window.anvil
  const trimmedPrompt = prompt.trim()
  const canSubmitPrompt = !!settings?.hasApiKey && !running && trimmedPrompt.length > 0

  const refreshSessions = useCallback(async () => {
    if (!window.anvil || !settings) return
    const list = await window.anvil.sessions.list(settings.workspacePath)
    setSessions(list)
  }, [setSessions, settings])

  useEffect(() => {
    if (!window.anvil) return
    window.anvil.settings.get().then((s) => {
      setSettingsState(s)
      setDraftBaseUrl(s.baseUrl)
      setDraftModel(s.model)
      setDraftStitchProjectId(s.stitchProjectId || '')
      setDraftWorkspacePath(s.workspacePath || '')
    })
    const off = window.anvil.onAgentEvent((env) => {
      ingest(env)
      if (autoFollow && env.event && 'itemId' in env.event && env.event.itemId) {
        setSelectedItemId(env.event.itemId as string)
      }
    })
    return off
  }, [ingest, autoFollow])

  useEffect(() => {
    if (settings) refreshSessions()
  }, [settings, refreshSessions])

  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId) {
      setActiveSessionId(sessionId)
    }
  }, [sessionId, activeSessionId])

  useEffect(() => {
    if (!running) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        window.anvil?.cancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 3000)
    return () => clearTimeout(t)
  }, [notice])

  useEffect(() => {
    if (running || !queuedPrompt || turns.length === 0) return
    const lastTurn = turns[turns.length - 1]
    if (lastTurn.status === 'running') return
    if (lastConsumedTurnIdRef.current === lastTurn.id) return
    lastConsumedTurnIdRef.current = lastTurn.id

    const q = queuedPrompt
    setQueuedPrompt(null)

    if (lastTurn.status === 'completed') {
      if (!fireDirect(currentSessionRequest(q))) {
        setPrompt((prev) => (prev.trim().length === 0 ? q : `${prev}\n\n${q}`))
        setNotice('上一轮完成但发送被并发任务抢占，已合并回输入框')
      }
      return
    }

    setPrompt((prev) => (prev.trim().length === 0 ? q : `${prev}\n\n${q}`))
    setNotice(
      lastTurn.status === 'failed'
        ? '上一轮失败，待发消息已合并回输入框，请确认后重发'
        : '已取消，待发消息已合并回输入框，请确认后重发',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, turns, queuedPrompt])

  async function saveSettings() {
    if (!window.anvil) return
    const patch: Partial<AnvilSettings> = {
      baseUrl: draftBaseUrl,
      model: draftModel,
      stitchProjectId: draftStitchProjectId,
      workspacePath: draftWorkspacePath,
    }
    if (draftKey) patch.apiKey = draftKey
    const fresh = await window.anvil.settings.set(patch)
    setSettingsState(fresh)
    setDraftKey('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function executeQuery(req: QueryRequest) {
    if (!window.anvil) {
      submittingRef.current = false
      return
    }
    if (req.mode === 'new') {
      reset()
      setActiveSessionId(null)
    }
    setSelectedItemId(null)
    setDismissedErrorCount(0)
    setRunning(true)
    try {
      const result = await window.anvil.query(req)
      if (result && !result.ok && result.error) {
        pushError(result.error)
      }
      if (result?.sessionId) setActiveSessionId(result.sessionId)
      await refreshSessions()
    } catch (e: any) {
      pushError(e?.message ?? String(e))
    } finally {
      submittingRef.current = false
      setPendingPrompt(null)
      setRunning(false)
    }
  }

  function currentSessionRequest(text: string): QueryRequest {
    return activeSessionId
      ? { mode: 'resume', sessionId: activeSessionId, prompt: text }
      : { mode: 'new', prompt: text }
  }

  function fireDirect(req: QueryRequest) {
    if (submittingRef.current) return false
    submittingRef.current = true
    setPendingPrompt(req.prompt)
    executeQuery(req)
    return true
  }

  function submitPrompt(mode: PromptMode) {
    if (!settings?.hasApiKey || trimmedPrompt.length === 0) return
    if (running) {
      enqueueNext()
      return
    }
    const req: QueryRequest =
      mode === 'new'
        ? { mode: 'new', prompt: trimmedPrompt }
        : currentSessionRequest(trimmedPrompt)
    if (!fireDirect(req)) return
    setPrompt('')
  }

  function enqueueNext() {
    if (trimmedPrompt.length === 0) return
    const replacing = !!queuedPrompt
    setQueuedPrompt(trimmedPrompt)
    setPrompt('')
    setNotice(replacing ? '已替换排队消息' : '已排队，将在当前任务完成后自动发送')
  }

  function editQueued() {
    if (!queuedPrompt) return
    setPrompt((prev) =>
      prev.trim().length === 0 ? queuedPrompt : `${prev}\n\n${queuedPrompt}`,
    )
    setQueuedPrompt(null)
  }

  function clearQueued() {
    setQueuedPrompt(null)
    setNotice('已取消排队消息')
  }

  function runNew() {
    submitPrompt('new')
  }

  function runSend() {
    submitPrompt('send')
  }

  function handlePromptKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      if (trimmedPrompt.length === 0) return
      if (running) enqueueNext()
      else runSend()
    }
  }

  async function cancelRun() {
    if (!window.anvil) return
    await window.anvil.cancel()
  }

  async function openSession(s: SessionMeta) {
    if (!window.anvil) return
    setQueuedPrompt(null)
    setPendingPrompt(null)
    lastConsumedTurnIdRef.current = null
    setActiveSessionId(s.id)
    const events = await window.anvil.sessions.events(s.id)
    loadFromEvents(events)
    setSelectedItemId(null)
  }

  async function deleteSession(s: SessionMeta, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.anvil) return
    const { confirmed } = await window.anvil.dialog.confirm({
      title: '删除 session？',
      message: `确定删除 session "${s.title || s.id.slice(0, 12)}"？`,
      detail: '该操作会同时清除该会话下的全部事件记录，不可恢复。',
      confirmLabel: '删除',
      cancelLabel: '取消',
      destructive: true,
    })
    if (!confirmed) return
    await window.anvil.sessions.delete(s.id)
    if (activeSessionId === s.id) {
      reset()
      setActiveSessionId(null)
    }
    await refreshSessions()
  }

  async function decideApproval(approvalId: string, decision: 'allow' | 'deny') {
    if (!window.anvil) return
    await window.anvil.approval.decide({ approvalId, decision })
  }

  const selectedItem = selectedItemId ? items[selectedItemId] : null
  const visibleErrors = errors.slice(dismissedErrorCount)
  const lastTurn = turns[turns.length - 1]
  const awaitingFirstItem =
    running && (turns.length === 0 || !lastTurn || lastTurn.status !== 'running' || lastTurn.itemIds.length === 0)

  return (
    <div className="h-screen overflow-hidden flex flex-col font-body-sm bg-background text-on-surface select-none relative">

      {/* Header */}
      <header className="flex items-center pl-[80px] pr-4 w-full bg-surface text-primary border-b border-outline-variant h-12 app-header shrink-0 z-10 relative">
        <div className="flex items-center gap-2 mr-6 no-drag">
          <LogoIcon className="h-[22px] w-[22px] shrink-0" />
          <span className="font-headline text-[16px] text-primary tracking-tight font-semibold">Anvil</span>
          <span className="text-outline-variant text-[14px]">/</span>
          <span className="text-on-surface-variant font-semibold text-[12px]">Workbench</span>
        </div>
        <div className="flex-grow" />
        <div className="flex items-center gap-2 no-drag">
          {settings && (
            <span className="bg-[#1c1b1d] border border-outline-variant text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-mono-code">
              {settings.workspacePath ? '📁 ' + truncatePath(settings.workspacePath) : 'no workspace'}
            </span>
          )}
          {settings && (
            <span className="bg-[#1c1b1d] border border-outline-variant text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-mono-code">
              {settings.model}
            </span>
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
            hasAnvil ? 'bg-[#1f3a1f] text-[#6fbf6f]' : 'bg-[#3a1f1f] text-[#ff8080]'
          }`}>
            {hasAnvil ? 'connected' : 'disconnected'}
          </span>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="px-2 py-0.5 text-[10px] font-mono-label bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface-variant cursor-pointer"
          >
            ⚙ Settings
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {visibleErrors.length > 0 && (
        <div className="bg-[#3a1f1f] border-b border-[#5a2f2f] px-4 py-2 flex items-center gap-3 no-drag shrink-0">
          <AlertCircle size={14} className="text-[#ff8080] shrink-0" />
          <div className="flex-1 text-[#ffb4ab] text-[12px] font-body-sm truncate">
            {visibleErrors[visibleErrors.length - 1]}
          </div>
          <button
            onClick={() => setDismissedErrorCount(errors.length)}
            className="text-[#ff8080] hover:text-[#ffffff] text-[12px] px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Notice Banner */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="bg-[#1f2a3a] border-b border-[#2f4a5a] px-4 py-2 flex items-center gap-3 no-drag shrink-0"
        >
          <div className="flex-1 text-[#a0c4ff] text-[12px] font-body-sm truncate">
            {notice}
          </div>
          <button
            onClick={() => setNotice(null)}
            aria-label="关闭提示"
            className="text-[#a0c4ff] hover:text-[#ffffff] text-[12px] px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Settings drawer */}
      {showSettings && (
        <SettingsDrawer
          settings={settings}
          draftBaseUrl={draftBaseUrl}
          draftKey={draftKey}
          draftModel={draftModel}
          draftStitchProjectId={draftStitchProjectId}
          draftWorkspacePath={draftWorkspacePath}
          saved={saved}
          onChangeBaseUrl={setDraftBaseUrl}
          onChangeKey={setDraftKey}
          onChangeModel={setDraftModel}
          onChangeStitch={setDraftStitchProjectId}
          onChangeWorkspace={setDraftWorkspacePath}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      <div className="flex flex-1 overflow-hidden relative">

        {/* Sidebar — Sessions */}
        <nav className="flex flex-col bg-surface-container text-primary w-[260px] border-r border-outline-variant shrink-0 z-0 no-drag">
          <div className="p-3 border-b border-outline-variant flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold flex items-center gap-1">
                <History size={11} /> Sessions ({sessions.length})
              </span>
              <button
                onClick={refreshSessions}
                className="text-on-surface-variant hover:text-primary p-0.5 cursor-pointer"
                title="刷新"
              >
                <RotateCw size={11} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {sessions.length === 0 && (
              <div className="text-on-surface-variant italic text-[11px] p-2">还没有 session</div>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => openSession(s)}
                className={`group p-2 cursor-pointer text-[11px] border-l-2 transition-colors flex flex-col gap-0.5 ${
                  activeSessionId === s.id
                    ? 'bg-surface-container-high border-primary'
                    : 'border-transparent hover:bg-surface-container-high'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-on-surface truncate flex-1 font-body-sm font-medium">
                    {s.title || s.id.slice(0, 12)}
                  </span>
                  <button
                    onClick={(e) => deleteSession(s, e)}
                    className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-[#ff8080] p-0.5"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
                <div className="flex items-center gap-2 font-mono-label text-[9px] text-on-surface-variant">
                  <span>{s.turnCount}t</span>
                  <span className={
                    s.lastStatus === 'failed' ? 'text-[#ff8080]' :
                    s.lastStatus === 'running' ? 'text-[#4a9eff]' :
                    'text-[#6fbf6f]'
                  }>
                    {s.lastStatus}
                  </span>
                  <span>{formatRelative(s.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Main — Conversation */}
        <main className="flex-1 flex flex-col bg-background overflow-hidden no-drag">

          {/* Conversation scroll */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            {turns.length === 0 && !running && (
              <div className="text-center text-on-surface-variant italic text-[12px] opacity-75 py-12 flex flex-col items-center gap-2">
                <FileSearch size={28} />
                <div>开始一个新对话或从左侧选择历史 session</div>
              </div>
            )}
            {turns.map((turn) => {
              if (turn.status === 'running' && turn.itemIds.length === 0) return null
              return (
                <div key={turn.id} className="flex flex-col gap-2.5">
                  {turn.itemIds.map((id) => {
                    const item = items[id]
                    if (!item) return null
                    return (
                      <MainItemView
                        key={id}
                        item={item}
                        isSelected={selectedItemId === id}
                        onSelect={() => setSelectedItemId(id)}
                      />
                    )
                  })}
                  {turn.status !== 'running' && turn.stats && (
                    <div className="text-[10px] font-mono-label text-on-surface-variant flex gap-3 px-1">
                      <span className={
                        turn.status === 'failed' ? 'text-[#ff8080]' : 'text-[#6fbf6f]'
                      }>{turn.status}</span>
                      {turn.stats.durationMs && <span>{(turn.stats.durationMs / 1000).toFixed(1)}s</span>}
                      {turn.stats.outputTokens != null && <span>{turn.stats.outputTokens} out</span>}
                      {turn.stats.cacheReadTokens != null && turn.stats.cacheReadTokens > 0 && (
                        <span>cache: {turn.stats.cacheReadTokens}</span>
                      )}
                      {turn.stats.costUsd != null && <span>${turn.stats.costUsd.toFixed(4)}</span>}
                    </div>
                  )}
                </div>
              )
            })}
            {awaitingFirstItem && (
              <>
                {pendingPrompt && <UserEchoCard prompt={pendingPrompt} />}
                <ThinkingIndicator
                  hasTurnStarted={turns.length > 0}
                  anchorRef={loadingAnchorRef}
                  autoFollow={autoFollow}
                />
              </>
            )}
          </div>

          {/* Pending Approvals Panel */}
          {pendingApprovals.length > 0 && (
            <div className="border-t border-[#f59e0b] bg-[#2a1f0f] p-3 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={14} className="text-[#f59e0b]" />
                <span className="font-mono-label text-[10px] text-[#f59e0b] uppercase tracking-wider">
                  Awaiting Approval ({pendingApprovals.length})
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {pendingApprovals.map((p) => (
                  <ApprovalCard key={p.approvalId} approval={p} onDecide={decideApproval} />
                ))}
              </div>
            </div>
          )}

          {/* Prompt Input */}
          <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex flex-col gap-2 shrink-0">
            {queuedPrompt && (
              <div className="border border-[#4a9eff]/40 bg-[#1f2a3a] px-3 py-2 flex items-center gap-2">
                <span className="font-mono-label text-[10px] text-[#4a9eff] uppercase tracking-wider shrink-0">
                  📩 Queued next
                </span>
                <div className="flex-1 text-[12px] text-on-surface truncate font-mono-code">
                  {queuedPrompt}
                </div>
                <button
                  onClick={editQueued}
                  className="text-[10px] font-mono-label text-on-surface-variant hover:text-primary cursor-pointer px-2"
                >
                  编辑
                </button>
                <button
                  onClick={clearQueued}
                  className="text-[10px] font-mono-label text-[#ff8080] hover:text-[#ffffff] cursor-pointer px-2"
                  aria-label="取消排队消息"
                >
                  ✕
                </button>
              </div>
            )}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handlePromptKeyDown}
              className="w-full bg-background border border-outline-variant text-on-surface text-[12px] p-2 focus:border-primary focus:outline-none resize-none font-mono-code leading-normal"
              rows={3}
              placeholder={
                running
                  ? queuedPrompt
                    ? '输入并回车将替换已排队消息...'
                    : '运行中，输入并回车将在当前任务结束后自动发送...'
                  : '输入指令...'
              }
            />
            <div className="flex justify-between items-center gap-2">
              <label className="flex items-center gap-1.5 font-mono-label text-[10px] text-on-surface-variant cursor-pointer">
                <input type="checkbox" checked={autoFollow} onChange={(e) => setAutoFollow(e.target.checked)} />
                auto-follow
              </label>
              <div className="flex gap-2">
                <button
                  onClick={runNew}
                  disabled={!canSubmitPrompt}
                  className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest disabled:bg-[#252527] disabled:text-[#666668] disabled:cursor-not-allowed border border-outline-variant text-on-surface text-[11px] font-mono-label transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus size={11} /> New
                </button>
                {running ? (
                  <>
                    {trimmedPrompt.length > 0 && (
                      <button
                        onClick={enqueueNext}
                        className="px-3 py-1.5 bg-[#1f2a3a] hover:bg-[#2f4a5a] border border-[#4a9eff]/40 text-[#a0c4ff] text-[11px] font-mono-label transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {queuedPrompt ? 'Replace queue' : 'Queue next'}
                      </button>
                    )}
                    <button
                      onClick={cancelRun}
                      className="px-4 py-1.5 bg-[#3a1f1f] hover:bg-[#5a2f2f] text-[#ff8080] font-semibold text-[11px] transition-colors cursor-pointer"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    onClick={runSend}
                    disabled={!canSubmitPrompt}
                    className="px-4 py-1.5 bg-[#ffffff] hover:bg-zinc-200 disabled:bg-[#252527] disabled:text-[#666668] disabled:cursor-not-allowed text-[#000000] font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    发送
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Inspector */}
        <aside className="w-[400px] border-l border-outline-variant bg-[#0d0d0f] overflow-hidden no-drag flex flex-col">
          {selectedItem ? (
            <Inspector item={selectedItem} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant italic text-[11px] opacity-75 p-4 text-center">
              <FileSearch size={24} className="mb-2 opacity-40" />
              点击左侧 conversation item 查看详情
            </div>
          )}
        </aside>
      </div>

      <footer className="flex justify-between items-center px-4 w-full bg-surface-container-lowest text-on-surface-variant font-mono-code text-[10px] h-8 border-t border-outline-variant shrink-0 z-10 relative">
        <div className="flex gap-4">
          <span className="uppercase">session: {sessionId?.slice(0, 8) || 'none'}</span>
          {turns.length > 0 && turns[turns.length - 1].stats && (
            <>
              <span className="uppercase">tokens: {turns[turns.length - 1].stats?.outputTokens || 0}</span>
              <span className="uppercase">latency: {turns[turns.length - 1].stats?.durationMs ? `${turns[turns.length - 1].stats?.durationMs}ms` : '-'}</span>
            </>
          )}
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => setShowDebug(!showDebug)} className="hover:text-primary cursor-pointer uppercase">
            {showDebug ? '隐藏' : '显示'} debug ({rawEvents.length})
          </button>
          <span>v0.0.2 · dev</span>
        </div>
      </footer>

      {showDebug && (
        <div className="absolute right-4 bottom-12 w-[320px] max-h-[300px] bg-surface-container-lowest border border-outline-variant p-4 z-50 overflow-y-auto shadow-lg rounded">
          <div className="flex justify-between items-center border-b border-outline-variant pb-2 mb-2">
            <span className="font-mono-label text-[10px] text-primary uppercase">Raw Events ({rawEvents.length})</span>
            <button onClick={() => setShowDebug(false)} className="text-on-surface-variant hover:text-primary">✕</button>
          </div>
          <pre className="font-mono-code text-[10px] text-outline-variant leading-relaxed">
            {rawEvents.map((e, i) => `${i}: ${e.event.type}\n`).join('') || 'No events.'}
          </pre>
        </div>
      )}
    </div>
  )
}

function UserEchoCard({ prompt }: { prompt: string }) {
  return (
    <div className="font-mono-code text-[13px] text-on-surface flex gap-2 py-1 px-1 leading-relaxed">
      <span className="text-[#6fbf6f] shrink-0">&gt;</span>
      <span className="whitespace-pre-wrap break-words flex-1">{prompt}</span>
    </div>
  )
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const THINKING_VERBS = ['Thinking', 'Pondering', 'Reasoning', 'Computing']

function ThinkingIndicator({
  hasTurnStarted,
  anchorRef,
  autoFollow,
}: {
  hasTurnStarted: boolean
  anchorRef: React.RefObject<HTMLDivElement | null>
  autoFollow: boolean
}) {
  const [frame, setFrame] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [verbIndex, setVerbIndex] = useState(() => Math.floor(Math.random() * THINKING_VERBS.length))
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    setElapsed(0)
  }, [hasTurnStarted])

  useEffect(() => {
    const spinnerTimer = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length)
    }, 80)
    const elapsedTimer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    const verbTimer = setInterval(() => {
      setVerbIndex((i) => (i + 1) % THINKING_VERBS.length)
    }, 9000)
    return () => {
      clearInterval(spinnerTimer)
      clearInterval(elapsedTimer)
      clearInterval(verbTimer)
    }
  }, [])

  useEffect(() => {
    if (autoFollow && anchorRef.current) {
      anchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [autoFollow, hasTurnStarted, anchorRef])

  const warnAt = hasTurnStarted ? 20 : 10
  const dangerAt = hasTurnStarted ? 28 : 14
  const elapsedColor =
    elapsed >= dangerAt ? 'text-[#ff8080]' :
    elapsed >= warnAt ? 'text-[#f59e0b]' :
    'text-on-surface-variant opacity-70'

  const phaseColor = hasTurnStarted ? 'text-[#e5e1e4]' : 'text-[#8e9192]'
  const spinnerColor = hasTurnStarted ? 'text-[#4a9eff]' : 'text-[#8e9192]'
  const label = hasTurnStarted ? THINKING_VERBS[verbIndex] : 'Connecting'

  return (
    <div
      ref={anchorRef}
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="font-mono-code text-[13px] flex items-center gap-2 py-1 px-1 leading-relaxed"
    >
      <span aria-hidden="true" className={`${spinnerColor} text-[15px] w-4 inline-block`}>
        {SPINNER_FRAMES[frame]}
      </span>
      <span className={phaseColor}>{label}…</span>
      <span aria-hidden="true" className={`${elapsedColor} text-[11px]`}>
        ({elapsed}s · Esc 或点击「取消」中断)
      </span>
    </div>
  )
}

function MainItemView({ item, isSelected, onSelect }: { item: Item; isSelected: boolean; onSelect: () => void }) {
  const baseClass = `p-3 border cursor-pointer transition-colors ${isSelected ? 'border-primary' : 'border-outline-variant hover:border-outline'}`

  if (item.kind === 'text') {
    return (
      <div onClick={onSelect} className={`${baseClass} bg-surface-container-low`}>
        <div className="font-mono-label text-[9px] text-on-surface-variant uppercase mb-1.5 tracking-wider">
          {item.role === 'assistant' ? 'Assistant' : item.role}
        </div>
        <MarkdownText text={item.text || '...'} />
      </div>
    )
  }

  if (item.kind === 'thinking') {
    return (
      <details onClick={onSelect} className={`${baseClass} bg-surface-container-low`}>
        <summary className="font-mono-label text-[9px] text-on-surface-variant uppercase cursor-pointer">
          Thinking ({item.text.length} chars)
        </summary>
        <div className="text-on-surface-variant text-[12px] mt-2 italic whitespace-pre-wrap">{item.text}</div>
      </details>
    )
  }

  if (item.kind === 'tool_use') {
    const decisionLabel =
      item.approvalDecision === 'allow' ? '✓ allowed' :
      item.approvalDecision === 'deny' ? '✕ denied' :
      item.approvalId ? '⏳ awaiting approval' : null

    return (
      <div onClick={onSelect} className={`${baseClass} bg-surface-container-low`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono-label text-[9px] text-[#f59e0b] uppercase tracking-wider">🔧 {item.toolName}</span>
          {item.approvalRisk && (
            <span className={`text-[9px] font-mono-label uppercase ${
              item.approvalRisk === 'high' ? 'text-[#ff8080]' :
              item.approvalRisk === 'medium' ? 'text-[#f59e0b]' :
              'text-on-surface-variant'
            }`}>{item.approvalRisk} risk</span>
          )}
          {decisionLabel && (
            <span className={`text-[9px] font-mono-label uppercase ${
              item.approvalDecision === 'deny' ? 'text-[#ff8080]' :
              item.approvalDecision === 'allow' ? 'text-[#6fbf6f]' :
              'text-[#f59e0b]'
            }`}>{decisionLabel}</span>
          )}
          {item.toolOutput == null && (
            <span className="text-[9px] font-mono-label text-[#4a9eff] uppercase">running</span>
          )}
          {item.toolIsError && (
            <span className="text-[9px] font-mono-label text-[#ff8080] uppercase">error</span>
          )}
        </div>
        <div className="font-mono-code text-[11px] text-on-surface-variant truncate">
          {typeof item.toolInput === 'string' ? item.toolInput : JSON.stringify(item.toolInput || {}).slice(0, 200)}
        </div>
      </div>
    )
  }

  return (
    <div onClick={onSelect} className={`${baseClass} bg-surface-container-low opacity-75`}>
      <div className="font-mono-label text-[9px] text-on-surface-variant uppercase">{item.role} · {item.kind}</div>
      <div className="text-on-surface text-[11px] whitespace-pre-wrap">{item.text}</div>
    </div>
  )
}

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="text-on-surface text-[13px] leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={markdownComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

function Inspector({ item }: { item: Item }) {
  return (
    <>
      <div className="flex items-center px-4 py-2 border-b border-outline-variant bg-surface-container-low shrink-0">
        <span className="font-mono-code text-[11px] text-on-surface-variant uppercase flex-1">
          Inspector: {item.kind === 'tool_use' ? item.toolName : item.kind}
        </span>
        <button
          onClick={() => navigator.clipboard.writeText(JSON.stringify(item, null, 2))}
          className="px-3 py-1 text-[10px] font-mono-label bg-surface border border-outline-variant text-on-surface hover:text-primary cursor-pointer"
        >
          复制 JSON
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 font-mono-code text-[11px] leading-relaxed text-[#ccc]">
        <pre className="whitespace-pre-wrap">
          {JSON.stringify(item, null, 2)}
        </pre>
      </div>
    </>
  )
}

function ApprovalCard({ approval, onDecide }: { approval: PendingApproval; onDecide: (id: string, d: 'allow' | 'deny') => void }) {
  const riskColor =
    approval.risk === 'high' ? 'text-[#ff8080]' :
    approval.risk === 'medium' ? 'text-[#f59e0b]' :
    'text-on-surface-variant'

  return (
    <div className="bg-surface-container border border-outline-variant p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono-label text-[10px] text-on-surface uppercase">{approval.toolName}</span>
        <span className={`font-mono-label text-[9px] uppercase ${riskColor}`}>{approval.risk} risk</span>
      </div>
      <pre className="font-mono-code text-[10px] text-on-surface-variant max-h-32 overflow-auto bg-[#0d0d0f] p-2 rounded">
        {typeof approval.input === 'string' ? approval.input : JSON.stringify(approval.input, null, 2).slice(0, 400)}
      </pre>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => onDecide(approval.approvalId, 'deny')}
          className="px-3 py-1 bg-[#3a1f1f] hover:bg-[#5a2f2f] text-[#ff8080] text-[10px] font-mono-label cursor-pointer"
        >
          Deny
        </button>
        <button
          onClick={() => onDecide(approval.approvalId, 'allow')}
          className="px-3 py-1 bg-[#1f3a1f] hover:bg-[#2f5a2f] text-[#6fbf6f] text-[10px] font-mono-label cursor-pointer"
        >
          Allow once
        </button>
      </div>
    </div>
  )
}

function SettingsDrawer(props: {
  settings: PublicSettings | null
  draftBaseUrl: string
  draftKey: string
  draftModel: string
  draftStitchProjectId: string
  draftWorkspacePath: string
  saved: boolean
  onChangeBaseUrl: (v: string) => void
  onChangeKey: (v: string) => void
  onChangeModel: (v: string) => void
  onChangeStitch: (v: string) => void
  onChangeWorkspace: (v: string) => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <div className="bg-surface-container border-b border-outline-variant px-4 py-3 grid gap-2 shrink-0 no-drag">
      <div className="flex items-center justify-between mb-1">
        <span className="font-headline text-[12px] font-semibold text-primary">Settings</span>
        <button onClick={props.onClose} className="text-on-surface-variant hover:text-primary text-[12px]">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SettingField label="Workspace Path" value={props.draftWorkspacePath} placeholder="/path/to/project" onChange={props.onChangeWorkspace} />
        <SettingField label="Base URL" value={props.draftBaseUrl} placeholder="https://..." onChange={props.onChangeBaseUrl} />
        <SettingField
          label="API Key"
          value={props.draftKey}
          type="password"
          placeholder={props.settings?.hasApiKey ? '已配置 (保持不变)' : 'sk-... 或 tp-...'}
          onChange={props.onChangeKey}
        />
        <SettingField label="Model" value={props.draftModel} placeholder="mimo-v2.5-pro" onChange={props.onChangeModel} />
        <SettingField label="Stitch Project ID" value={props.draftStitchProjectId} placeholder="（可选）" onChange={props.onChangeStitch} />
      </div>
      <button onClick={props.onSave} className="self-end px-4 py-1 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-on-surface font-mono-label text-[11px] cursor-pointer">
        {props.saved ? '✅ 已保存' : '保存配置'}
      </button>
    </div>
  )
}

function SettingField({ label, value, onChange, placeholder, type }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono-label text-[9px] text-on-surface-variant uppercase">{label}</span>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-background border border-outline-variant text-on-surface font-mono-code text-[11px] px-2 py-1 focus:border-primary focus:outline-none"
      />
    </label>
  )
}

function truncatePath(p: string): string {
  if (p.length < 30) return p
  const parts = p.split('/')
  if (parts.length <= 3) return p
  return `…/${parts.slice(-2).join('/')}`
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  return date.toLocaleDateString()
}
