import { useCallback, useEffect, useRef, useState } from 'react'

interface ResizablePanelOptions {
  initialWidth: number
  min: number
  max: number
  storageKey?: string
}

export function useResizablePanel({ initialWidth, min, max, storageKey }: ResizablePanelOptions) {
  const clamp = useCallback((w: number) => Math.min(max, Math.max(min, w)), [min, max])

  const [width, setWidth] = useState<number>(() => {
    if (storageKey && typeof localStorage !== 'undefined') {
      const saved = Number(localStorage.getItem(storageKey))
      if (Number.isFinite(saved) && saved > 0) return Math.min(max, Math.max(min, saved))
    }
    return initialWidth
  })

  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const moveRef = useRef<((e: MouseEvent) => void) | null>(null)
  const upRef = useRef<(() => void) | null>(null)

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startWidth: width }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMove = (ev: MouseEvent) => {
        const drag = dragRef.current
        if (!drag) return
        setWidth(clamp(drag.startWidth + (drag.startX - ev.clientX)))
      }
      const onUp = () => {
        dragRef.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        if (moveRef.current) window.removeEventListener('mousemove', moveRef.current)
        if (upRef.current) window.removeEventListener('mouseup', upRef.current)
      }
      moveRef.current = onMove
      upRef.current = onUp
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [width, clamp],
  )

  useEffect(() => {
    if (storageKey && typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, String(width))
    }
  }, [width, storageKey])

  useEffect(() => {
    return () => {
      if (moveRef.current) window.removeEventListener('mousemove', moveRef.current)
      if (upRef.current) window.removeEventListener('mouseup', upRef.current)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  return { width, startResize }
}
