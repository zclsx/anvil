import { useState, useEffect, useCallback, useRef } from 'react'
import { useAgentStore } from './store'
import type { AnvilSettings, PublicSettings } from '../electron/shared/settings'
import type { AgentEventEnvelope } from '../electron/shared/events'
import type { SessionMeta, QueryRequest } from '../electron/shared/session'
import type {
  ConfirmRequest,
  ConfirmResponse,
  PickDirectoryRequest,
  PickDirectoryResponse,
} from '../electron/shared/dialog'
import type { UpdateSnapshot } from '../electron/shared/updates'
import {
  formatPathLiteral,
  formatWorkspaceShort,
  getComparablePath,
  getPromptPathDisplay,
  getWorkspaceRelativePath,
  normalizePathForCompare,
  truncatePath,
} from './lib/pathUtils'
import { formatRelative } from './lib/timeUtils'
import { formatFileReferenceLabel, isImagePath } from './lib/fileUtils'
import { InspectorPanel } from './components/InspectorPanel'
import { ApprovalsPanel } from './components/Approvals/ApprovalsPanel'
import { ErrorBanner } from './components/ErrorBanner'
import { NoticeBanner } from './components/NoticeBanner'
import { Footer } from './components/Footer'
import { DebugPanel } from './components/DebugPanel'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { SettingsDrawer } from './components/SettingsDrawer'
import { Conversation } from './components/Conversation'
import { PromptInput } from './components/PromptInput'
import { useGlobalFileDropGuard } from './hooks/useGlobalFileDropGuard'
import { useEscapeToCancel } from './hooks/useEscapeToCancel'
import { useUpdates } from './hooks/useUpdates'
import { useAutoScroll } from './hooks/useAutoScroll'

type FileReference = {
  path: string
  promptPath: string
  label: string
  isImage: boolean
  isOutsideWorkspace: boolean
}

type ExecuteQueryOptions = {
  onFail?: () => void
}

type ChooseWorkspaceOptions = {
  forcePicker?: boolean
  keepDraft?: boolean
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
        workspaceExists: (workspacePath: string) => Promise<{ exists: boolean }>
        setWorkspace: (sessionId: string, workspacePath: string) => Promise<{ ok: boolean; error?: string }>
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
        pickDirectory: (req?: PickDirectoryRequest) => Promise<PickDirectoryResponse>
      }
      updates: {
        get: () => Promise<UpdateSnapshot>
        check: () => Promise<UpdateSnapshot>
        download: () => Promise<UpdateSnapshot>
        install: () => Promise<{ ok: boolean; error?: string }>
        onStatus: (callback: (snapshot: UpdateSnapshot) => void) => () => void
      }
      files: {
        getPaths: (files: File[]) => string[]
        openPath: (filePath: string) => Promise<{ ok: boolean; error?: string }>
        showInFolder: (filePath: string) => Promise<{ ok: boolean; error?: string }>
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
  const [isDraftWorkspacePathDirty, setIsDraftWorkspacePathDirty] = useState(false)
  const [running, setRunning] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [autoFollow, setAutoFollow] = useState(true)
  const [dismissedErrorCount, setDismissedErrorCount] = useState(0)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [pendingWorkspace, setPendingWorkspace] = useState<string | null>(null)
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null)
  const [fileReferences, setFileReferences] = useState<FileReference[]>([])
  const [queuedFileReferences, setQueuedFileReferences] = useState<FileReference[]>([])
  const [showFileReferencePaths, setShowFileReferencePaths] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [isFileDragActive, setIsFileDragActive] = useState(false)
  const submittingRef = useRef(false)
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null)
  const loadingAnchorRef = useRef<HTMLDivElement | null>(null)
  const conversationEndRef = useRef<HTMLDivElement | null>(null)
  const lastConsumedTurnIdRef = useRef<string | null>(null)
  const activeSessionIdRef = useRef<string | null>(null)
  const autoConsumingRef = useRef(false)
  const autoDraftWorkspaceRef = useRef<string | null>(null)

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
  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) ?? null : null
  const displayWorkspace = activeSession?.workspacePath ?? pendingWorkspace ?? ''
  const isDraftWorkspace = !!pendingWorkspace && !activeSession
  const hasRunnableWorkspace = !!activeSession || !!pendingWorkspace
  const canChooseWorkspace = !running
  const canSendPrompt = !!settings?.hasApiKey && !running && trimmedPrompt.length > 0 && hasRunnableWorkspace
  const hasFileReferencesWithoutPrompt = fileReferences.length > 0 && trimmedPrompt.length === 0

  const refreshSessions = useCallback(async () => {
    if (!window.anvil) return
    const list = await window.anvil.sessions.list()
    setSessions(list)
  }, [setSessions])

  useEffect(() => {
    if (!window.anvil) return
    window.anvil.settings.get().then((s) => {
      setSettingsState(s)
      setDraftBaseUrl(s.baseUrl)
      setDraftModel(s.model)
      setDraftStitchProjectId(s.stitchProjectId || '')
      setDraftWorkspacePath(s.workspacePath || '')
      setIsDraftWorkspacePathDirty(false)
    })
    const off = window.anvil.onAgentEvent((env) => {
      ingest(env)
      if (autoFollow && env.event && 'itemId' in env.event && env.event.itemId) {
        setSelectedItemId(env.event.itemId as string)
      }
    })
    return off
  }, [ingest, autoFollow])

  useGlobalFileDropGuard(() => setIsFileDragActive(false))

  const {
    snapshot: updateSnapshot,
    check: checkForUpdates,
    download: downloadUpdate,
    install: installUpdate,
  } = useUpdates({ onError: pushError, onNotice: setNotice })

  useEffect(() => {
    if (settings) refreshSessions()
  }, [settings, refreshSessions])

  useEffect(() => {
    if (!window.anvil || !settings?.workspacePath) return
    if (running || activeSessionId || pendingWorkspace) return
    if (autoDraftWorkspaceRef.current === settings.workspacePath) return

    let cancelled = false
    const workspacePath = settings.workspacePath
    autoDraftWorkspaceRef.current = workspacePath

    window.anvil.sessions.workspaceExists(workspacePath)
      .then((result) => {
        if (cancelled || activeSessionIdRef.current) return
        if (!result.exists) {
          setNotice('默认 workspace 不可用，请点 New 重新选择')
          return
        }
        reset()
        setPendingWorkspace(workspacePath)
        setNotice(`已使用默认 workspace：${formatWorkspaceShort(workspacePath)}`)
        requestAnimationFrame(() => promptInputRef.current?.focus())
      })
      .catch((error: unknown) => {
        if (!cancelled) pushError(error instanceof Error ? error.message : String(error))
      })

    return () => {
      cancelled = true
    }
  }, [activeSessionId, pendingWorkspace, pushError, reset, running, settings])

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
    if (sessionId && sessionId !== activeSessionId) {
      setActiveSessionId(sessionId)
    }
  }, [sessionId, activeSessionId])

  useEscapeToCancel(running, () => {
    window.anvil?.cancel()
  })

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
    const refs = queuedFileReferences
    setQueuedPrompt(null)
    setQueuedFileReferences([])

    if (lastTurn.status === 'completed') {
      const req = currentSessionRequest(q, refs)
      if (!req) {
        restoreDraft(q, refs)
        setNotice('上一轮完成但发送被并发任务抢占，已合并回输入框')
        return
      }
      void (async () => {
        autoConsumingRef.current = true
        try {
          const ready = await ensureWorkspaceForRequest(req)
          if (!ready) {
            restoreDraft(q, refs)
            setNotice('Workspace 不可用，待发消息已合并回输入框')
            return
          }
          if (!fireDirect(req)) {
            restoreDraft(q, refs)
            setNotice('上一轮完成但发送被并发任务抢占，已合并回输入框')
          }
        } catch (error: unknown) {
          restoreDraft(q, refs)
          pushError(error instanceof Error ? error.message : String(error))
          setNotice('发送排队消息失败，已合并回输入框')
        } finally {
          autoConsumingRef.current = false
        }
      })()
      return
    }

    restoreDraft(q, refs)
    setNotice(
      lastTurn.status === 'failed'
        ? '上一轮失败，待发消息已合并回输入框，请确认后重发'
        : '已取消，待发消息已合并回输入框，请确认后重发',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, turns, queuedPrompt, queuedFileReferences])

  async function saveSettings() {
    if (!window.anvil) return
    const patch: Partial<AnvilSettings> = {
      baseUrl: draftBaseUrl,
      model: draftModel,
      stitchProjectId: draftStitchProjectId,
    }
    if (isDraftWorkspacePathDirty && draftWorkspacePath !== (settings?.workspacePath || '')) {
      patch.workspacePath = draftWorkspacePath
    }
    if (draftKey) patch.apiKey = draftKey
    const fresh = await window.anvil.settings.set(patch)
    setSettingsState(fresh)
    setDraftWorkspacePath(fresh.workspacePath || '')
    setIsDraftWorkspacePathDirty(false)
    setDraftKey('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function executeQuery(req: QueryRequest, options?: ExecuteQueryOptions) {
    if (!window.anvil) {
      submittingRef.current = false
      return
    }
    let failed = false
    const notifyFailed = () => {
      if (failed) return
      failed = true
      options?.onFail?.()
    }
    if (req.mode === 'new') {
      reset()
      setActiveSessionId(null)
    }
    setSelectedItemId(null)
    setDismissedErrorCount(useAgentStore.getState().errors.length)
    setRunning(true)
    try {
      const result = await window.anvil.query(req)
      if (result && !result.ok && result.error) {
        pushError(result.error)
        notifyFailed()
      }
      if (result?.sessionId) {
        setActiveSessionId(result.sessionId)
        setPendingWorkspace(null)
      }
      await refreshSessions()
    } catch (e: any) {
      pushError(e?.message ?? String(e))
      notifyFailed()
    } finally {
      submittingRef.current = false
      setPendingPrompt(null)
      setRunning(false)
    }
  }

  function currentSessionRequest(text: string, references: FileReference[] = fileReferences): QueryRequest | null {
    const promptText = buildPromptWithFileReferences(text, references)
    const referencedPaths = references.map((r) => r.path)
    if (activeSessionId) {
      return { mode: 'resume', sessionId: activeSessionId, prompt: promptText, referencedPaths }
    }
    if (pendingWorkspace) {
      return { mode: 'new', prompt: promptText, workspacePath: pendingWorkspace, referencedPaths }
    }
    return null
  }

  function fireDirect(req: QueryRequest, options?: ExecuteQueryOptions) {
    if (submittingRef.current) return false
    if (req.mode === 'resume' && activeSessionIdRef.current !== req.sessionId) return false
    submittingRef.current = true
    setPendingPrompt(req.prompt)
    void executeQuery(req, options)
    return true
  }

  async function submitPrompt(mode: PromptMode) {
    if (!settings?.hasApiKey) return
    if (trimmedPrompt.length === 0) {
      if (fileReferences.length > 0) {
        setNotice('请先输入指令，再发送文件引用')
      }
      return
    }
    if (running) {
      enqueueNext()
      return
    }
    const refs = fileReferences
    const req = currentSessionRequest(trimmedPrompt, refs)
    if (!req) {
      setNotice('请先点 New 选择 workspace 目录')
      return
    }
    if (mode === 'send') {
      const ready = await ensureWorkspaceForRequest(req)
      if (!ready) return
    }
    const textSnapshot = trimmedPrompt
    const refsSnapshot = refs
    if (!fireDirect(req, { onFail: () => restoreDraft(textSnapshot, refsSnapshot) })) return
    setPrompt('')
    setFileReferences([])
    setShowFileReferencePaths(false)
  }

  function enqueueNext() {
    if (trimmedPrompt.length === 0) {
      if (fileReferences.length > 0) {
        setNotice('请先输入指令，再排队文件引用')
      }
      return
    }
    const replacing = !!queuedPrompt
    const replacedReferenceCount = queuedFileReferences.length
    const queuedReferenceCount = fileReferences.length
    setQueuedPrompt(trimmedPrompt)
    setQueuedFileReferences(fileReferences)
    setPrompt('')
    setFileReferences([])
    setShowFileReferencePaths(false)
    setNotice(
      replacing
        ? `已替换排队消息${queuedReferenceCount > 0 ? `（含 ${queuedReferenceCount} 个文件引用）` : ''}${replacedReferenceCount > 0 ? '，旧文件引用已一并替换' : ''}`
        : `已排队，将在当前任务完成后自动发送${queuedReferenceCount > 0 ? `（含 ${queuedReferenceCount} 个文件引用）` : ''}`,
    )
  }

  function mergeTextIntoPrompt(text: string) {
    setPrompt((prev) => (prev.trim().length === 0 ? text : `${prev}\n\n${text}`))
  }

  function restoreDraft(text: string, references: FileReference[]) {
    mergeTextIntoPrompt(text)
    setFileReferences((prev) => mergeFileReferences(prev, references))
  }

  function buildPromptWithFileReferences(text: string, references: FileReference[]) {
    const promptText = text.trim()
    if (references.length === 0) return promptText

    const referencedFiles = references
      .map((reference, index) => `${index + 1}. ${reference.promptPath}`)
      .join('\n')

    return `${promptText}\n\nReferenced files:\n${referencedFiles}`
  }

  function mergeFileReferences(current: FileReference[], incoming: FileReference[]) {
    const seen = new Set(current.map((reference) => getComparablePath(normalizePathForCompare(reference.path))))
    const next = [...current]
    for (const reference of incoming) {
      const key = getComparablePath(normalizePathForCompare(reference.path))
      if (seen.has(key)) continue
      seen.add(key)
      next.push(reference)
    }
    return next
  }

  function createFileReference(filePath: string): FileReference {
    const renderedPath = displayWorkspace
      ? (getWorkspaceRelativePath(filePath, displayWorkspace) ?? filePath)
      : filePath

    return {
      path: filePath,
      promptPath: formatPathLiteral(renderedPath),
      label: formatFileReferenceLabel(renderedPath),
      isImage: isImagePath(filePath),
      isOutsideWorkspace: !!displayWorkspace && renderedPath !== '.' && !renderedPath.startsWith('./'),
    }
  }

  function isFileDrop(event: React.DragEvent) {
    return Array.from(event.dataTransfer.types).includes('Files')
  }

  function handlePromptDragOver(event: React.DragEvent) {
    if (!isFileDrop(event)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    setIsFileDragActive(true)
  }

  function handlePromptDragLeave(event: React.DragEvent) {
    const currentTarget = event.currentTarget
    const relatedTarget = event.relatedTarget
    if (relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) return
    setIsFileDragActive(false)
  }

  function handlePromptDrop(event: React.DragEvent) {
    if (!isFileDrop(event)) return
    event.preventDefault()
    event.stopPropagation()
    setIsFileDragActive(false)

    const files = Array.from(event.dataTransfer.files)
    if (files.length === 0) return

    const rawPaths = window.anvil?.files.getPaths(files) ?? []
    const paths = rawPaths.filter((path) => path.length > 0)
    const ignoredCount = files.length - paths.length
    if (paths.length === 0) {
      setNotice(`未能读取拖入文件的本地路径（${ignoredCount} 个已忽略）`)
      return
    }

    const incomingReferences = paths.map(createFileReference)
    const existingKeys = new Set(fileReferences.map((reference) => getComparablePath(normalizePathForCompare(reference.path))))
    const referencesToAdd = incomingReferences.filter((reference) => {
      const key = getComparablePath(normalizePathForCompare(reference.path))
      if (existingKeys.has(key)) return false
      existingKeys.add(key)
      return true
    })
    const duplicateCount = incomingReferences.length - referencesToAdd.length

    if (referencesToAdd.length > 0) {
      setFileReferences((prev) => mergeFileReferences(prev, referencesToAdd))
    }

    const outsideCount = referencesToAdd.filter((reference) => reference.isOutsideWorkspace).length

    let nextNotice =
      referencesToAdd.length === 0
        ? '文件引用已存在'
        : displayWorkspace
          ? `已添加 ${referencesToAdd.length} 个文件引用`
          : `已添加 ${referencesToAdd.length} 个文件引用（未选 workspace，发送时使用绝对路径）`
    if (outsideCount > 0) {
      nextNotice = `已添加 ${referencesToAdd.length} 个文件引用，其中 ${outsideCount} 个在当前 workspace 外`
    }
    if (duplicateCount > 0) {
      nextNotice = `${nextNotice}；${duplicateCount} 个重复引用已忽略`
    }
    if (ignoredCount > 0) {
      nextNotice = `${nextNotice}；${ignoredCount} 个无本地路径已忽略`
    }
    setNotice(nextNotice)
    requestAnimationFrame(() => promptInputRef.current?.focus())
  }

  function editQueued() {
    if (!queuedPrompt) return
    restoreDraft(queuedPrompt, queuedFileReferences)
    setQueuedPrompt(null)
    setQueuedFileReferences([])
  }

  function clearQueued() {
    setQueuedPrompt(null)
    setQueuedFileReferences([])
    setNotice('已取消排队消息')
  }

  function removeFileReference(pathToRemove: string) {
    const keyToRemove = getComparablePath(normalizePathForCompare(pathToRemove))
    const nextReferences = fileReferences.filter(
      (reference) => getComparablePath(normalizePathForCompare(reference.path)) !== keyToRemove,
    )
    setFileReferences(nextReferences)
    if (nextReferences.length === 0) {
      setShowFileReferencePaths(false)
    }
  }

  async function chooseWorkspaceForNewSession(options: ChooseWorkspaceOptions = {}) {
    if (!window.anvil || running) return
    if (autoConsumingRef.current) {
      setNotice('正在发送排队消息，请稍后再切换 workspace')
      return
    }

    let workspacePath: string | null = null
    let usedDefaultWorkspace = false

    if (!options.forcePicker && settings?.workspacePath) {
      const result = await window.anvil.sessions.workspaceExists(settings.workspacePath)
      if (result.exists) {
        workspacePath = settings.workspacePath
        usedDefaultWorkspace = true
      } else {
        setNotice('默认 workspace 不可用，请重新选择')
      }
    }

    if (!workspacePath) {
      const result = await window.anvil.dialog.pickDirectory({
        defaultPath: displayWorkspace || settings?.workspacePath,
        title: '选择新会话的 workspace',
      })
      if (result.canceled) return
      if (!result.path) {
        setNotice('选择的目录不可用，请重新选择')
        return
      }
      workspacePath = result.path
    }

    setPendingWorkspace(workspacePath)

    if (options.keepDraft) {
      const hadFileReferences = fileReferences.length > 0
      setFileReferences([])
      setShowFileReferencePaths(false)
      setNotice(
        hadFileReferences
          ? `workspace 已更新为 ${formatWorkspaceShort(workspacePath)}（文件引用已清空，请重新拖入）`
          : `workspace 已更新为 ${formatWorkspaceShort(workspacePath)}`,
      )
    } else {
      reset()
      setActiveSessionId(null)
      setQueuedPrompt(null)
      setQueuedFileReferences([])
      setFileReferences([])
      setShowFileReferencePaths(false)
      setPendingPrompt(null)
      lastConsumedTurnIdRef.current = null
    }

    if (!options.keepDraft && usedDefaultWorkspace) {
      setNotice(`已使用默认 workspace：${formatWorkspaceShort(workspacePath)}`)
    } else if (!options.keepDraft) {
      setNotice(`已选择 workspace：${formatWorkspaceShort(workspacePath)}`)
    }
    requestAnimationFrame(() => promptInputRef.current?.focus())
  }

  async function ensureWorkspaceForRequest(req: QueryRequest) {
    if (!window.anvil) return false

    if (req.mode === 'new') {
      const result = await window.anvil.sessions.workspaceExists(req.workspacePath)
      if (result.exists) return true
      setNotice('Draft workspace 不存在，请点 New 重新选择目录')
      return false
    }

    const sessionForRequest = sessions.find((s) => s.id === req.sessionId) ?? null
    if (!sessionForRequest) {
      setNotice('Session 不存在，请从左侧重新选择')
      return false
    }

    const result = await window.anvil.sessions.workspaceExists(sessionForRequest.workspacePath)
    if (result.exists) return true

    const { confirmed } = await window.anvil.dialog.confirm({
      title: 'Workspace 不存在',
      message: `找不到 session 的 workspace：${sessionForRequest.workspacePath}`,
      detail: '请重新指定该 session 的项目目录，取消则不会发送这条消息。',
      confirmLabel: '重新指定',
      cancelLabel: '取消',
    })
    if (!confirmed) {
      setNotice('已取消发送，请重新指定 workspace 或选择其他 session')
      return false
    }

    const picked = await window.anvil.dialog.pickDirectory({
      defaultPath: settings?.workspacePath,
      title: '重新指定 session workspace',
    })
    if (picked.canceled) {
      setNotice('已取消发送，请重新指定 workspace 或选择其他 session')
      return false
    }
    if (!picked.path) {
      setNotice('选择的目录不可用，请重新指定 workspace')
      return false
    }

    const updated = await window.anvil.sessions.setWorkspace(sessionForRequest.id, picked.path)
    if (!updated.ok) {
      pushError(updated.error ?? '更新 session workspace 失败')
      return false
    }
    await refreshSessions()
    setNotice(`已更新 session workspace：${formatWorkspaceShort(picked.path)}`)
    return true
  }

  function runNew() {
    void chooseWorkspaceForNewSession()
  }

  function runChangeDraftWorkspace() {
    void chooseWorkspaceForNewSession({ forcePicker: true, keepDraft: true })
  }

  function updateDraftWorkspacePath(value: string) {
    setDraftWorkspacePath(value)
    setIsDraftWorkspacePathDirty(true)
  }

  function runSend() {
    void submitPrompt('send')
  }

  function handlePromptKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      if (trimmedPrompt.length === 0) {
        if (fileReferences.length > 0) {
          setNotice('请先输入指令，再发送文件引用')
        }
        return
      }
      if (running) enqueueNext()
      else void submitPrompt('send')
    }
  }

  async function cancelRun() {
    if (!window.anvil) return
    await window.anvil.cancel()
  }

  async function openSession(s: SessionMeta) {
    if (!window.anvil) return
    if (autoConsumingRef.current) {
      setNotice('正在发送排队消息，请稍后再切换 session')
      return
    }
    if (running) {
      setNotice('请先取消当前任务或等待结束后再切换 session')
      return
    }
    setQueuedPrompt(null)
    setQueuedFileReferences([])
    setFileReferences([])
    setShowFileReferencePaths(false)
    setPendingPrompt(null)
    setPendingWorkspace(null)
    lastConsumedTurnIdRef.current = null
    setActiveSessionId(s.id)
    const events = await window.anvil.sessions.events(s.id)
    loadFromEvents(events)
    // Replayed history may contain past error events; mark them as already
    // seen so a stale error (e.g. an old timeout) doesn't pop the top banner
    // as if it just happened. New errors after the switch still surface.
    setDismissedErrorCount(useAgentStore.getState().errors.length)
    setSelectedItemId(null)
  }

  async function deleteSession(s: SessionMeta, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.anvil) return
    if (autoConsumingRef.current) {
      setNotice('正在发送排队消息，请稍后再删除 session')
      return
    }
    if (running) {
      setNotice('请先取消当前任务或等待结束后再删除 session')
      return
    }
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
      setPendingWorkspace(null)
      setQueuedPrompt(null)
      setQueuedFileReferences([])
      setFileReferences([])
      setShowFileReferencePaths(false)
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

  useAutoScroll({
    turns,
    items,
    pendingApprovalCount: pendingApprovals.length,
    autoFollow,
    awaitingFirstItem,
    conversationEndRef,
  })

  return (
    <div className="h-screen overflow-hidden flex flex-col font-body-sm bg-background text-on-surface select-none relative">

      <Header
        settings={settings}
        displayWorkspace={displayWorkspace}
        isDraftWorkspace={isDraftWorkspace}
        hasAnvil={hasAnvil}
        updateSnapshot={updateSnapshot}
        onCheckUpdate={checkForUpdates}
        onDownloadUpdate={downloadUpdate}
        onInstallUpdate={installUpdate}
        onToggleSettings={() => setShowSettings((v) => !v)}
      />

      {visibleErrors.length > 0 && (
        <ErrorBanner
          message={visibleErrors[visibleErrors.length - 1]}
          onDismiss={() => setDismissedErrorCount(errors.length)}
        />
      )}

      {notice && <NoticeBanner message={notice} onDismiss={() => setNotice(null)} />}

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
          onChangeWorkspace={updateDraftWorkspacePath}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      <div className="flex flex-1 overflow-hidden relative">

        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onRefresh={refreshSessions}
          onOpenSession={openSession}
          onDeleteSession={deleteSession}
        />

        {/* Main — Conversation */}
        <main className="flex-1 flex flex-col bg-background overflow-hidden no-drag">

          <Conversation
            turns={turns}
            items={items}
            running={running}
            pendingWorkspace={pendingWorkspace}
            pendingPrompt={pendingPrompt}
            selectedItemId={selectedItemId}
            autoFollow={autoFollow}
            awaitingFirstItem={awaitingFirstItem}
            loadingAnchorRef={loadingAnchorRef}
            conversationEndRef={conversationEndRef}
            onSelectItem={setSelectedItemId}
            displayWorkspace={displayWorkspace}
          />

          <ApprovalsPanel approvals={pendingApprovals} onDecide={decideApproval} />

          <PromptInput
            prompt={prompt}
            trimmedPrompt={trimmedPrompt}
            promptInputRef={promptInputRef}
            isFileDragActive={isFileDragActive}
            running={running}
            hasRunnableWorkspace={hasRunnableWorkspace}
            canChooseWorkspace={canChooseWorkspace}
            canSendPrompt={canSendPrompt}
            isDraftWorkspace={isDraftWorkspace}
            displayWorkspace={displayWorkspace}
            activeSession={activeSession}
            pendingWorkspace={pendingWorkspace}
            fileReferences={fileReferences}
            showFileReferencePaths={showFileReferencePaths}
            hasFileReferencesWithoutPrompt={hasFileReferencesWithoutPrompt}
            queuedPrompt={queuedPrompt}
            queuedFileReferencesCount={queuedFileReferences.length}
            autoFollow={autoFollow}
            onPromptChange={setPrompt}
            onPromptKeyDown={handlePromptKeyDown}
            onDragOver={handlePromptDragOver}
            onDragLeave={handlePromptDragLeave}
            onDrop={handlePromptDrop}
            onRemoveFileReference={removeFileReference}
            onToggleFileReferencePaths={() => setShowFileReferencePaths((open) => !open)}
            onEditQueued={editQueued}
            onClearQueued={clearQueued}
            onAutoFollowChange={setAutoFollow}
            onNew={runNew}
            onChangeDraftWorkspace={runChangeDraftWorkspace}
            onSend={runSend}
            onEnqueueNext={enqueueNext}
            onCancel={cancelRun}
          />
        </main>

        <InspectorPanel item={selectedItem} />
      </div>

      <Footer
        sessionId={sessionId}
        lastTurn={turns[turns.length - 1]}
        showDebug={showDebug}
        rawEventsCount={rawEvents.length}
        onToggleDebug={() => setShowDebug(!showDebug)}
      />

      {showDebug && <DebugPanel rawEvents={rawEvents} onClose={() => setShowDebug(false)} />}
    </div>
  )
}
