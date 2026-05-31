import { useCallback, useEffect, useState } from 'react'

export const EXPAND_TRACE_SHORTCUT = {
  key: 'e',
  withMeta: true,
  label: '⌘/Ctrl + E',
}

export function useConversationExpand() {
  const [expandAll, setExpandAll] = useState(false)
  const toggleExpandAll = useCallback(() => setExpandAll((v) => !v), [])

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
        setExpandAll((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { expandAll, toggleExpandAll }
}
