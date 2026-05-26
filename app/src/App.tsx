import { useState, useEffect } from 'react'

interface AnvilSettings {
  baseUrl: string
  apiKey: string
  model: string
}

declare global {
  interface Window {
    anvil?: {
      settings: {
        get: () => Promise<AnvilSettings>
        set: (patch: Partial<AnvilSettings>) => Promise<AnvilSettings>
      }
      query: (args: { prompt: string }) => Promise<{ ok: boolean; count: number }>
      onMessage: (callback: (msg: unknown) => void) => () => void
    }
  }
}

export function App() {
  const [prompt, setPrompt] = useState('你好，介绍下你自己')
  const [settings, setSettingsState] = useState<AnvilSettings>({
    baseUrl: '',
    apiKey: '',
    model: '',
  })
  const [messages, setMessages] = useState<any[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const hasAnvil = typeof window !== 'undefined' && !!window.anvil

  useEffect(() => {
    if (!window.anvil) return
    window.anvil.settings.get().then(setSettingsState)
    const off = window.anvil.onMessage((msg) => {
      setMessages((prev) => [...prev, msg])
    })
    return off
  }, [])

  async function saveSettings() {
    if (!window.anvil) return
    const fresh = await window.anvil.settings.set(settings)
    setSettingsState(fresh)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function run() {
    setMessages([])
    setError(null)
    setRunning(true)
    try {
      if (!window.anvil) {
        throw new Error('window.anvil 未注入')
      }
      await window.anvil.query({ prompt })
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setRunning(false)
    }
  }

  function patchSetting<K extends keyof AnvilSettings>(key: K, value: AnvilSettings[K]) {
    setSettingsState((s) => ({ ...s, [key]: value }))
  }

  return (
    <div className="container">
      <h1>🔨 Anvil — Hello World</h1>

      <div className={`status ${hasAnvil ? 'ok' : 'fail'}`}>
        Preload: {hasAnvil ? '✅ 已注入' : '❌ 未注入'}
      </div>

      <div className="config">
        <label>
          Base URL:
          <input
            value={settings.baseUrl}
            onChange={(e) => patchSetting('baseUrl', e.target.value)}
            placeholder="https://..."
          />
        </label>
        <label>
          API Key:
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => patchSetting('apiKey', e.target.value)}
            placeholder="sk-... 或 tp-..."
          />
        </label>
        <label>
          Model:
          <input
            value={settings.model}
            onChange={(e) => patchSetting('model', e.target.value)}
            placeholder="mimo-v2.5-pro / claude-sonnet-4-6 / ..."
          />
        </label>
        <button onClick={saveSettings} className="save-btn">
          {saved ? '✅ 已保存' : '保存配置'}
        </button>
      </div>

      <div className="prompt">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
        <button onClick={run} disabled={running || !settings.apiKey}>
          {running ? '运行中...' : '发送'}
        </button>
      </div>

      {error && (
        <div className="error">
          <strong>错误：</strong>
          <pre>{error}</pre>
        </div>
      )}

      <div className="messages">
        {messages.map((msg: any, i) => (
          <div key={i} className={`msg msg-${msg.type}`}>
            <div className="msg-header">[{msg.type}] {msg.subtype || ''}</div>
            <pre>{JSON.stringify(msg, null, 2).slice(0, 500)}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}
