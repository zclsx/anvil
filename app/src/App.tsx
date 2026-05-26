import { useState, useEffect } from 'react'
import { History, FileSearch } from 'lucide-react'
import { useAgentStore } from './store'
import type { AnvilSettings, PublicSettings } from '../electron/shared/settings'
import type { AgentEventEnvelope } from '../electron/shared/events'

declare global {
  interface Window {
    anvil?: {
      settings: {
        get: () => Promise<PublicSettings>
        set: (patch: Partial<AnvilSettings>) => Promise<PublicSettings>
      }
      query: (args: { prompt: string }) => Promise<{ ok: boolean }>
      onAgentEvent: (callback: (envelope: AgentEventEnvelope) => void) => () => void
    }
  }
}

export function App() {
  const [prompt, setPrompt] = useState('你好，介绍下你自己')
  const [settings, setSettingsState] = useState<PublicSettings | null>(null)
  const [draftKey, setDraftKey] = useState('')
  const [draftBaseUrl, setDraftBaseUrl] = useState('')
  const [draftModel, setDraftModel] = useState('')
  const [draftStitchProjectId, setDraftStitchProjectId] = useState('')
  const [running, setRunning] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [autoFollow, setAutoFollow] = useState(true)
  const [dismissedErrorCount, setDismissedErrorCount] = useState(0)

  const turns = useAgentStore((s) => s.turns)
  const items = useAgentStore((s) => s.items)
  const rawEvents = useAgentStore((s) => s.rawEvents)
  const errors = useAgentStore((s) => s.errors)
  const ingest = useAgentStore((s) => s.ingest)
  const reset = useAgentStore((s) => s.reset)

  const hasAnvil = typeof window !== 'undefined' && !!window.anvil

  useEffect(() => {
    if (!window.anvil) return
    window.anvil.settings.get().then((s) => {
      setSettingsState(s)
      setDraftBaseUrl(s.baseUrl)
      setDraftModel(s.model)
      setDraftStitchProjectId(s.stitchProjectId || '')
    })
    const off = window.anvil.onAgentEvent((env) => {
      ingest(env)
      if (!autoFollow) return
      if (env.event && 'itemId' in env.event && env.event.itemId) {
        setSelectedItemId(env.event.itemId as string)
      }
    })
    return off
  }, [ingest, autoFollow])

  async function saveSettings() {
    if (!window.anvil) return
    const patch: Partial<AnvilSettings> = {
      baseUrl: draftBaseUrl,
      model: draftModel,
      stitchProjectId: draftStitchProjectId,
    }
    if (draftKey) patch.apiKey = draftKey
    const fresh = await window.anvil.settings.set(patch)
    setSettingsState(fresh)
    setDraftKey('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function run() {
    if (!window.anvil) return
    reset()
    setSelectedItemId(null)
    setDismissedErrorCount(0)
    setRunning(true)
    try {
      const result = await window.anvil.query({ prompt })
      if (result && 'error' in result && result.error) {
        useAgentStore.setState((s) => ({ errors: [...s.errors, result.error as string] }))
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e)
      useAgentStore.setState((s) => ({ errors: [...s.errors, msg] }))
    } finally {
      setRunning(false)
    }
  }

  const visibleErrors = errors.slice(dismissedErrorCount)

  const selectedItem = selectedItemId ? items[selectedItemId] : null

  return (
    <div className="h-screen overflow-hidden flex flex-col font-body-sm bg-background text-on-surface select-none relative">
      
      {/* 1. Header (macOS Traffic Light Padding) */}
      <header className="flex items-center pl-[80px] pr-4 w-full bg-surface text-primary border-b border-outline-variant h-12 app-header shrink-0 z-10 relative">
        <div className="flex items-center gap-2 mr-6 no-drag">
          <span className="font-headline text-[16px] text-primary tracking-tight font-semibold">Anvil</span>
          <span className="text-outline-variant text-[14px]">/</span>
          <span className="text-on-surface-variant font-semibold text-[12px]">Workbench</span>
        </div>
        <div className="flex-grow" />
        <div className="flex items-center gap-2 no-drag">
          <span className={`status-pill rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
            hasAnvil ? 'bg-[#1f3a1f] text-[#6fbf6f]' : 'bg-[#3a1f1f] text-[#ff8080]'
          }`}>
            {hasAnvil ? 'connected' : 'disconnected'}
          </span>
          {settings && (
            <span className="bg-[#1c1b1d] border border-outline-variant text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-mono-code">
              model: {settings.model}
            </span>
          )}
        </div>
      </header>

      {visibleErrors.length > 0 && (
        <div className="bg-[#3a1f1f] border-b border-[#5a2f2f] px-4 py-2 flex items-center gap-3 no-drag shrink-0">
          <span className="text-[#ff8080] font-mono-label text-[10px] uppercase tracking-wider shrink-0">Error</span>
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

      {/* 2. Main Workspace Panel */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left SideNavBar Drawer */}
        <nav className="flex flex-col py-4 bg-surface-container text-primary w-[240px] border-r border-outline-variant shrink-0 z-0 overflow-y-auto no-drag">
          <div className="px-4 mb-4 flex flex-col gap-1">
            <span className="font-headline text-[15px] text-primary font-semibold">Anvil</span>
            <span className="font-mono-label text-[9px] text-on-surface-variant tracking-wider uppercase">AI Agent Workbench</span>
          </div>
          
          <div className="flex flex-col gap-1 px-2 flex-grow">
            <div className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all flex items-center gap-3 px-3 py-1.5 cursor-pointer text-[12px]">
              <History size={14} />
              <span className="font-body-sm">Sessions ({turns.length})</span>
            </div>
            
            <div className="mt-4 mb-2 px-3">
              <span className="font-label-caps text-[9px] text-outline uppercase tracking-wider font-semibold">Connection Settings</span>
            </div>
            
            <div className="px-3 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-mono-label text-[9px] text-on-surface-variant">BASE URL</label>
                <input 
                  className="w-full bg-background border border-outline-variant text-on-surface font-mono-code text-[11px] px-2 py-1 focus:border-primary focus:outline-none transition-colors" 
                  type="text" 
                  value={draftBaseUrl} 
                  onChange={(e) => setDraftBaseUrl(e.target.value)} 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono-label text-[9px] text-on-surface-variant">API KEY</label>
                <input 
                  className="w-full bg-background border border-outline-variant text-on-surface font-mono-code text-[11px] px-2 py-1 focus:border-primary focus:outline-none transition-colors" 
                  type="password" 
                  value={draftKey} 
                  onChange={(e) => setDraftKey(e.target.value)} 
                  placeholder={settings?.hasApiKey ? '已配置 (保持不变)' : 'sk-... 或 tp-...'} 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono-label text-[9px] text-on-surface-variant">MODEL</label>
                <input 
                  className="w-full bg-background border border-outline-variant text-on-surface font-mono-code text-[11px] px-2 py-1 focus:border-primary focus:outline-none transition-colors" 
                  type="text" 
                  value={draftModel} 
                  onChange={(e) => setDraftModel(e.target.value)} 
                />
              </div>

              <button onClick={saveSettings} className="w-full text-center py-1.5 mt-2 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-on-surface font-mono-label text-[11px] transition-all cursor-pointer">
                {saved ? '✅ 已保存' : '保存配置'}
              </button>
            </div>
          </div>
        </nav>

        {/* Content Panel Area */}
        <main className="flex-1 flex overflow-hidden">
          
          {/* Column 1: Execution Trace Timeline */}
          <div className="w-[360px] border-r border-outline-variant flex flex-col bg-surface-dim overflow-hidden no-drag">
            <div className="p-4 bg-surface-dim border-b border-outline-variant shrink-0 flex items-start justify-between gap-2">
              <div>
                <h2 className="font-headline text-[13px] font-semibold text-primary">Execution Trace</h2>
                {turns.length > 0 && (
                  <p className="font-mono-label text-[9px] text-on-surface-variant mt-0.5">ID: {turns[turns.length - 1].id.slice(0, 12)}</p>
                )}
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer font-mono-label text-[9px] text-on-surface-variant uppercase tracking-wider select-none">
                <input
                  type="checkbox"
                  checked={autoFollow}
                  onChange={(e) => setAutoFollow(e.target.checked)}
                  className="cursor-pointer"
                />
                Auto-follow
              </label>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollable">
              {turns.map((turn) => (
                <div key={turn.id} className="flex flex-col gap-2.5">
                  {turn.itemIds.map((itemId) => {
                    const item = items[itemId]
                    if (!item) return null
                    const isSelected = selectedItemId === itemId
                    
                    let title = ''
                    let colorClass = ''
                    let summary = ''
                    
                    if (item.kind === 'text') {
                      title = item.role === 'assistant' ? 'Assistant' : 'User Input'
                      colorClass = item.role === 'assistant' ? 'bg-[#4a9eff]' : 'bg-[#10b981]'
                      summary = item.text
                    } else if (item.kind === 'thinking') {
                      title = 'Thinking Process'
                      colorClass = 'bg-[#a855f7]'
                      summary = item.text.length > 80 ? item.text.slice(0, 80) + '...' : item.text
                    } else if (item.kind === 'tool_use') {
                      title = `Tool: ${item.toolName}`
                      colorClass = 'bg-[#f59e0b]'
                      summary = typeof item.toolInput === 'string' ? item.toolInput : JSON.stringify(item.toolInput || '')
                    } else {
                      title = 'System Event'
                      colorClass = 'bg-gray-500'
                      summary = item.text
                    }

                    return (
                      <div 
                        key={itemId}
                        onClick={() => setSelectedItemId(itemId)}
                        className={`border p-3 transition-colors cursor-pointer flex flex-col gap-1.5 relative overflow-hidden group ${
                          isSelected ? 'bg-surface-container-high border-primary' : 'bg-surface border-outline-variant hover:border-outline'
                        }`}
                      >
                        {isSelected && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${colorClass} ${
                              item.kind === 'thinking' && turn.status === 'running' ? 'animate-pulse' : ''
                            }`} />
                            <span className="font-body-sm text-[12px] font-semibold text-primary">{title}</span>
                          </div>
                          <span className="font-mono-label text-[9px] text-on-surface-variant">
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="font-mono-code text-[11px] text-on-surface-variant truncate opacity-85 pl-4">
                          {summary}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ))}
              {turns.length === 0 && !running && (
                <div className="text-center py-16 text-on-surface-variant italic font-body-sm text-[11px] opacity-75">
                  没有运行轨迹——输入 Prompt 开始
                </div>
              )}
            </div>

            {/* Prompt Area Form at Bottom */}
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex flex-col gap-2.5 shrink-0">
              <textarea 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)} 
                className="w-full bg-background border border-outline-variant text-on-surface text-[12px] p-2 focus:border-primary focus:outline-none resize-none font-mono-code leading-normal" 
                rows={2}
                placeholder="输入指令，例如：“帮我重构页面”..."
              />
              <div className="flex justify-between items-center">
                <button 
                  onClick={reset} 
                  className="px-3 py-1 bg-transparent hover:bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface text-[11px] font-mono-label transition-colors cursor-pointer"
                >
                  清空历史
                </button>
                <button 
                  onClick={run} 
                  disabled={running || !settings?.hasApiKey} 
                  className="px-4 py-1.5 bg-[#ffffff] hover:bg-zinc-200 disabled:bg-[#252527] disabled:text-[#666668] disabled:cursor-not-allowed text-[#000000] font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  {running ? '运行中...' : '发送'}
                </button>
              </div>
            </div>
          </div>

          {/* Column 2: Syntax Highlighted Inspector & Detailed Log viewer */}
          <div className="flex-1 flex flex-col bg-[#0d0d0f] overflow-hidden no-drag">
            {selectedItem ? (
              <>
                <div className="flex items-center px-4 py-2 border-b border-outline-variant bg-surface-container-low shrink-0">
                  <span className="font-mono-code text-[11px] text-on-surface-variant uppercase flex-1">
                    Inspector: {selectedItem.kind === 'tool_use' ? selectedItem.toolName : selectedItem.kind}
                  </span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedItem, null, 2))}
                    className="px-3 py-1 text-[10px] font-mono-label bg-surface border border-outline-variant text-on-surface hover:text-primary hover:border-primary transition-colors cursor-pointer"
                  >
                    复制 JSON
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4 font-mono-code text-[12px] leading-relaxed text-[#ccc] scrollable">
                  <pre><code>
                    {JSON.stringify(
                      selectedItem.kind === 'tool_use' ? {
                        tool: selectedItem.toolName,
                        id: selectedItem.id,
                        input: selectedItem.toolInput,
                        output: selectedItem.toolOutput,
                        status: selectedItem.toolOutput != null ? (selectedItem.toolIsError ? 'error' : 'success') : 'pending'
                      } : {
                        id: selectedItem.id,
                        role: selectedItem.role,
                        kind: selectedItem.kind,
                        text: selectedItem.text
                      }, 
                      null, 
                      2
                    )}
                  </code></pre>
                </div>
                {/* Bottom STDERR/STDOUT Log Panel */}
                <div className="h-[240px] border-t border-outline-variant bg-surface-container-lowest flex flex-col shrink-0">
                  <div className="px-4 py-1.5 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
                    <span className="font-mono-label text-[9px] text-on-surface-variant uppercase tracking-wider">STDERR / STDOUT</span>
                    {selectedItem.kind === 'tool_use' && selectedItem.toolOutput == null && (
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-ping" />
                        <span className="font-mono-label text-[9px] text-[#f59e0b]">Awaiting Response...</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 font-mono-code text-[11px] text-outline-variant overflow-auto flex-1 whitespace-pre-wrap leading-normal scrollable">
                    {selectedItem.kind === 'tool_use' ? (
                      selectedItem.toolOutput ? (
                        <span className={selectedItem.toolIsError ? 'text-[#ff8080]' : ''}>
                          {typeof selectedItem.toolOutput === 'string' ? selectedItem.toolOutput : JSON.stringify(selectedItem.toolOutput, null, 2)}
                        </span>
                      ) : (
                        <span className="text-[#f59e0b] italic">&gt; Executing {selectedItem.toolName}...</span>
                      )
                    ) : (
                      <span className="opacity-70">&gt; No output logs for this event type.</span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant italic font-body-sm text-[12px] opacity-75">
                <FileSearch size={28} className="mb-2" />
                点击左侧 Execution Trace 步骤来审核参数和运行状态
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 3. Footer Monospace Bar */}
      <footer className="flex justify-between items-center px-4 w-full bg-surface-container-lowest text-on-surface-variant font-mono-code text-[10px] h-8 border-t border-outline-variant shrink-0 z-10 relative select-none">
        <div className="flex gap-4">
          <span className="uppercase">ENV: LOCAL</span>
          {turns.length > 0 && turns[turns.length - 1].stats && (
            <>
              <span className="uppercase">TOKENS: {turns[turns.length - 1].stats?.outputTokens || 0}</span>
              <span className="uppercase">LATENCY: {turns[turns.length - 1].stats?.durationMs ? `${turns[turns.length - 1].stats?.durationMs}ms` : '-'}</span>
            </>
          )}
        </div>
        <div className="flex gap-4 items-center no-drag">
          <button onClick={() => setShowDebug(!showDebug)} className="hover:text-primary transition-colors cursor-pointer uppercase">
            {showDebug ? '隐藏' : '显示'} Debug
          </button>
          <span className="text-outline-variant">|</span>
          <span>v0.0.1 · stable</span>
        </div>
      </footer>

      {/* 4. Absolute Floating Debug Panel */}
      {showDebug && (
        <div className="absolute right-4 bottom-12 w-[320px] max-h-[300px] bg-surface-container-lowest border border-outline-variant p-4 z-50 overflow-y-auto no-drag shadow-lg rounded">
          <div className="flex justify-between items-center border-b border-outline-variant pb-2 mb-2">
            <span className="font-mono-label text-[10px] text-primary uppercase font-semibold">Raw Stream Events ({rawEvents.length})</span>
            <button onClick={() => setShowDebug(false)} className="text-on-surface-variant hover:text-primary text-[10px]">✕</button>
          </div>
          <pre className="font-mono-code text-[10px] text-outline-variant leading-relaxed scrollable">
            {rawEvents.map((e, i) => `${i}: ${e.event.type}\n`).join('') || 'No events captured yet.'}
          </pre>
        </div>
      )}
    </div>
  )
}
