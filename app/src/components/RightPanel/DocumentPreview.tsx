import { useEffect, useRef, useState } from 'react'
import { renderAsync } from 'docx-preview'

export function DocumentPreview({ filePath }: { filePath: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setError('')

    void (async () => {
      const result = await window.anvil?.files.readDocxBytes(filePath)
      if (cancelled) return
      if (!result || !result.ok || !result.bytes) {
        setStatus('error')
        setError(result?.error ?? '读取文档失败')
        return
      }
      const container = containerRef.current
      if (!container) return
      container.innerHTML = ''
      try {
        await renderAsync(result.bytes, container, undefined, {
          inWrapper: true,
          ignoreLastRenderedPageBreak: true,
          renderAltChunks: false,
          renderComments: false,
          renderChanges: false,
          useBase64URL: true,
        })
        if (!cancelled) setStatus('ready')
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setError(e instanceof Error ? e.message : '渲染文档失败')
      }
    })()

    return () => {
      cancelled = true
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [filePath])

  return (
    <div className="flex-1 overflow-auto bg-[#e5e5ea] relative">
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-[#5b5b60] text-[12px] font-mono-label">
          加载预览…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[#b3261e] text-[12px] font-mono-label">
          预览失败：{error}
        </div>
      )}
      <div ref={containerRef} className={status === 'ready' ? 'py-4' : 'hidden'} />
    </div>
  )
}
