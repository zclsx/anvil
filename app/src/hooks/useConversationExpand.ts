import { useCallback, useEffect, useState } from 'react'

export const EXPAND_TRACE_SHORTCUT = {
  key: 'e',
  withMeta: true,
  label: '⌘/Ctrl + E',
}

export type ProcessExpandMode = 'default' | 'expanded' | 'collapsed'

export function useConversationExpand() {
  const [processExpandMode, setProcessExpandMode] = useState<ProcessExpandMode>('default')
  const toggleProcessExpandMode = useCallback(
    () => setProcessExpandMode((mode) => (mode === 'expanded' ? 'collapsed' : 'expanded')),
    [],
  )

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === EXPAND_TRACE_SHORTCUT.key
      ) {
        e.preventDefault()
        setProcessExpandMode((mode) => (mode === 'expanded' ? 'collapsed' : 'expanded'))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { processExpandMode, toggleProcessExpandMode }
}
