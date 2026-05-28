import { useState, useEffect, useCallback, useRef } from 'react'
import {
  History,
  FileSearch,
  Plus,
  RotateCw,
  Shield,
  AlertCircle,
  Trash2,
  FolderOpen,
  File as FileIcon,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
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
import { LogoIcon } from './components/LogoIcon'
import { UpdateActionButton } from './components/UpdateActionButton'
import { UserEchoCard } from './components/Conversation/UserEchoCard'
import { ThinkingIndicator } from './components/Conversation/ThinkingIndicator'
import { MainItemView } from './components/Conversation/MainItemView'
import { Inspector } from './components/Inspector'
import { ApprovalCard } from './components/Approvals/ApprovalCard'
import { SettingField } from './components/SettingsDrawer/SettingField'

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
  const [updateSnapshot, setUpdateSnapshot] = useState<UpdateSnapshot | null>(null)
  const submittingRef = useRef(false)
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null)
  const loadingAnchorRef = useRef<HTMLDivElement | null>(null)
  const conversationEndRef = useRef<HTMLDivElement | null>(null)
  const lastConsumedTurnIdRef = useRef<string | null>(null)
  const activeSessionIdRef = useRef<string | null>(null)
  const autoConsumingRef = useRef(false)
  const autoDraftWorkspaceRef = useRef<string | null>(null)
  const autoScrollStateRef = useRef({
    awaitingFirstItem: false,
    lastItemId: null as string | null | undefined,
    lastTurnId: undefined as string | undefined,
    lastTurnStatus: undefined as string | undefined,
    lastTurnItemCount: 0,
    pendingApprovalCount: 0,
    turnsLength: 0,
  })

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

  useEffect(() => {
    function preventFileNavigation(event: DragEvent) {
      if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return
      event.preventDefault()
      if (event.type === 'drop') {
        setIsFileDragActive(false)
      }
    }

    window.addEventListener('dragover', preventFileNavigation)
    window.addEventListener('drop', preventFileNavigation)
    return () => {
      window.removeEventListener('dragover', preventFileNavigation)
      window.removeEventListener('drop', preventFileNavigation)
    }
  }, [])

  useEffect(() => {
    if (!window.anvil?.updates) return
    let mounted = true
    window.anvil.updates.get()
      .then((snapshot) => {
        if (mounted) setUpdateSnapshot(snapshot)
      })
      .catch((error: unknown) => {
        pushError(error instanceof Error ? error.message : String(error))
      })
    const off = window.anvil.updates.onStatus((snapshot) => {
      setUpdateSnapshot(snapshot)
    })
    return () => {
      mounted = false
      off()
    }
  }, [pushError])

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
    setDismissedErrorCount(0)
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
    if (activeSessionId) {
      return { mode: 'resume', sessionId: activeSessionId, prompt: promptText }
    }
    if (pendingWorkspace) {
      return { mode: 'new', prompt: promptText, workspacePath: pendingWorkspace }
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

  async function checkForUpdates() {
    if (!window.anvil?.updates) return
    try {
      const snapshot = await window.anvil.updates.check()
      setUpdateSnapshot(snapshot)
      if (snapshot.status === 'not-available') {
        setNotice('当前已是最新版本')
      } else if (snapshot.status === 'error' && snapshot.message) {
        pushError(snapshot.message)
      }
    } catch (error: unknown) {
      pushError(error instanceof Error ? error.message : String(error))
    }
  }

  async function downloadUpdate() {
    if (!window.anvil?.updates) return
    try {
      const snapshot = await window.anvil.updates.download()
      setUpdateSnapshot(snapshot)
      if (snapshot.status === 'error' && snapshot.message) {
        pushError(snapshot.message)
      }
    } catch (error: unknown) {
      pushError(error instanceof Error ? error.message : String(error))
    }
  }

  async function installUpdate() {
    if (!window.anvil?.updates) return
    try {
      const result = await window.anvil.updates.install()
      if (!result.ok && result.error) pushError(result.error)
    } catch (error: unknown) {
      pushError(error instanceof Error ? error.message : String(error))
    }
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
  const lastTurnItemCount = lastTurn?.itemIds.length ?? 0
  const lastItemId = lastTurnItemCount > 0 ? lastTurn?.itemIds[lastTurnItemCount - 1] : null
  const lastItemTextLength = lastItemId ? (items[lastItemId]?.text?.length ?? 0) : 0
  const awaitingFirstItem =
    running && (turns.length === 0 || !lastTurn || lastTurn.status !== 'running' || lastTurn.itemIds.length === 0)

  useEffect(() => {
    const nextAutoScrollState = {
      awaitingFirstItem,
      lastItemId,
      lastTurnId: lastTurn?.id,
      lastTurnStatus: lastTurn?.status,
      lastTurnItemCount,
      pendingApprovalCount: pendingApprovals.length,
      turnsLength: turns.length,
    }
    const previous = autoScrollStateRef.current
    const isStructuralChange =
      previous.awaitingFirstItem !== nextAutoScrollState.awaitingFirstItem ||
      previous.lastItemId !== nextAutoScrollState.lastItemId ||
      previous.lastTurnId !== nextAutoScrollState.lastTurnId ||
      previous.lastTurnStatus !== nextAutoScrollState.lastTurnStatus ||
      previous.lastTurnItemCount !== nextAutoScrollState.lastTurnItemCount ||
      previous.pendingApprovalCount !== nextAutoScrollState.pendingApprovalCount ||
      previous.turnsLength !== nextAutoScrollState.turnsLength

    autoScrollStateRef.current = nextAutoScrollState
    if (!autoFollow) return
    conversationEndRef.current?.scrollIntoView({
      behavior: isStructuralChange ? 'smooth' : 'auto',
      block: 'end',
    })
  }, [
    autoFollow,
    awaitingFirstItem,
    lastItemId,
    lastItemTextLength,
    lastTurn?.id,
    lastTurn?.status,
    lastTurnItemCount,
    pendingApprovals.length,
    turns.length,
  ])

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
          {(settings || displayWorkspace) && (
            <span className="bg-[#1c1b1d] border border-outline-variant text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-mono-code">
              {displayWorkspace ? `📁 ${truncatePath(displayWorkspace)}${isDraftWorkspace ? ' (draft)' : ''}` : 'no workspace'}
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
          {updateSnapshot?.enabled && (
            <UpdateActionButton
              snapshot={updateSnapshot}
              onCheck={checkForUpdates}
              onDownload={downloadUpdate}
              onInstall={installUpdate}
            />
          )}
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
          onChangeWorkspace={updateDraftWorkspacePath}
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
                <div className="font-mono-code text-[9px] text-on-surface-variant truncate">
                  {formatWorkspaceShort(s.workspacePath)}
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
                <div>
                  {pendingWorkspace
                    ? `Workspace 已就绪：${formatWorkspaceShort(pendingWorkspace)}，请在下方输入指令`
                    : '点 New 选择 workspace 开始新对话，或从左侧选择历史 session'}
                </div>
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
            <div ref={conversationEndRef} aria-hidden="true" className="h-px shrink-0" />
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
          <div
            onDragOver={handlePromptDragOver}
            onDragLeave={handlePromptDragLeave}
            onDrop={handlePromptDrop}
            className={`p-4 border-t bg-surface-container-lowest flex flex-col gap-2 shrink-0 transition-colors ${
              isFileDragActive
                ? 'border-[#4a9eff] bg-[#111827]'
                : 'border-outline-variant'
            }`}
          >
            <div className="flex items-center gap-2 text-[10px] font-mono-label text-on-surface-variant">
              <FolderOpen size={12} className={displayWorkspace ? 'text-[#a0c4ff]' : 'text-on-surface-variant'} />
              <span className="uppercase shrink-0">
                {activeSession ? 'session workspace' : pendingWorkspace ? 'draft workspace' : 'workspace'}
              </span>
              <span className="font-mono-code truncate flex-1">
                {displayWorkspace ? formatWorkspaceShort(displayWorkspace) : 'none selected'}
              </span>
              {isDraftWorkspace && !running && (
                <button
                  onClick={runChangeDraftWorkspace}
                  className="text-[10px] font-mono-label text-[#a0c4ff] hover:text-primary cursor-pointer px-2"
                >
                  更改
                </button>
              )}
            </div>
            {isFileDragActive && (
              <div className="border border-[#4a9eff]/50 bg-[#1f2a3a] px-3 py-2 text-[11px] font-mono-code text-[#a0c4ff]">
                {running ? '松开后添加到草稿引用（不会自动发送）' : '松开后添加文件引用'}
              </div>
            )}
            {fileReferences.length > 0 && (
              <div className="flex flex-col gap-2 border border-outline-variant bg-surface-container px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                    引用
                  </span>
                  {fileReferences.map((reference) => {
                    const Icon = reference.isImage ? ImageIcon : FileIcon
                    return (
                      <span
                        key={reference.path}
                        title={reference.path}
                        className="inline-flex max-w-full items-center gap-1.5 border border-[#4a9eff]/35 bg-[#1f2a3a] px-2 py-1 text-[11px] text-[#d8e7ff]"
                      >
                        <Icon size={12} className={reference.isImage ? 'text-[#b7a7ff]' : 'text-[#a0c4ff]'} />
                        <span className="font-mono-code truncate max-w-[140px]">
                          {reference.label}
                        </span>
                        {reference.isOutsideWorkspace && (
                          <span className="font-mono-label text-[9px] text-[#f59e0b]">
                            外部
                          </span>
                        )}
                        <button
                          onClick={() => removeFileReference(reference.path)}
                          className="text-on-surface-variant hover:text-[#ffffff] cursor-pointer"
                          aria-label={`移除文件引用 ${reference.label}`}
                          title="移除"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    )
                  })}
                  <button
                    onClick={() => setShowFileReferencePaths((open) => !open)}
                    className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono-label text-on-surface-variant hover:text-primary cursor-pointer"
                    aria-expanded={showFileReferencePaths}
                    title={showFileReferencePaths ? '收起完整路径' : '查看完整路径'}
                  >
                    {showFileReferencePaths ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    路径
                  </button>
                </div>
                {showFileReferencePaths && (
                  <div className="border-t border-outline-variant pt-2 flex flex-col gap-1">
                    {fileReferences.map((reference, index) => {
                      const promptPathDisplay = getPromptPathDisplay(reference.promptPath)
                      return (
                        <div key={reference.path} className="grid grid-cols-[24px_1fr] gap-2 text-[11px]">
                          <span className="font-mono-label text-[#7fb2f0] text-right">
                            {index + 1}
                          </span>
                          <div className="font-mono-code text-on-surface-variant break-all">
                            <div>
                              {promptPathDisplay}
                            </div>
                            {reference.path !== promptPathDisplay && (
                              <div className="text-[10px] opacity-70">
                                本地路径：{reference.path}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {hasFileReferencesWithoutPrompt && (
                  <div className="border-t border-outline-variant pt-2 text-[11px] font-mono-code text-on-surface-variant">
                    请先输入指令，再发送这些文件引用
                  </div>
                )}
              </div>
            )}
            {queuedPrompt && (
              <div className="border border-[#4a9eff]/40 bg-[#1f2a3a] px-3 py-2 flex items-center gap-2">
                <span className="font-mono-label text-[10px] text-[#4a9eff] uppercase tracking-wider shrink-0">
                  📩 Queued next
                </span>
                <div className="flex-1 text-[12px] text-on-surface truncate font-mono-code">
                  {queuedPrompt}
                </div>
                {queuedFileReferences.length > 0 && (
                  <span className="font-mono-label text-[10px] text-[#a0c4ff] shrink-0">
                    +{queuedFileReferences.length} refs
                  </span>
                )}
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
              ref={promptInputRef}
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
                  : hasRunnableWorkspace
                    ? '输入指令...'
                    : '先点 New 选择 workspace 目录...'
              }
            />
            <div className="flex justify-between items-center gap-2">
              <label className="flex items-center gap-1.5 font-mono-label text-[10px] text-on-surface-variant cursor-pointer">
                <input type="checkbox" checked={autoFollow} onChange={(e) => setAutoFollow(e.target.checked)} />
                auto-follow
              </label>
              <div className="flex gap-2">
                <button
                  onClick={isDraftWorkspace ? runChangeDraftWorkspace : runNew}
                  disabled={!canChooseWorkspace}
                  className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest disabled:bg-[#252527] disabled:text-[#666668] disabled:cursor-not-allowed border border-outline-variant text-on-surface text-[11px] font-mono-label transition-colors cursor-pointer flex items-center gap-1"
                >
                  {isDraftWorkspace ? (
                    <>
                      <FolderOpen size={11} /> 更改目录
                    </>
                  ) : (
                    <>
                      <Plus size={11} /> New
                    </>
                  )}
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
                    disabled={!canSendPrompt}
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
          <span>v0.0.3 · dev</span>
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
        <SettingField label="Default Workspace Path" value={props.draftWorkspacePath} placeholder="/path/to/project" onChange={props.onChangeWorkspace} />
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


