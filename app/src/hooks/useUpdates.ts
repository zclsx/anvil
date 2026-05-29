import { useEffect, useRef, useState } from 'react'
import type { UpdateSnapshot } from '../../electron/shared/updates'

export function useUpdates({
  onError,
  onNotice,
}: {
  onError: (message: string) => void
  onNotice: (message: string) => void
}): {
  snapshot: UpdateSnapshot | null
  check: () => Promise<void>
  download: () => Promise<void>
  install: () => Promise<void>
} {
  const [snapshot, setSnapshot] = useState<UpdateSnapshot | null>(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const onNoticeRef = useRef(onNotice)
  onNoticeRef.current = onNotice

  useEffect(() => {
    if (!window.anvil?.updates) return
    let mounted = true
    window.anvil.updates.get()
      .then((next) => {
        if (mounted) setSnapshot(next)
      })
      .catch((error: unknown) => {
        onErrorRef.current(error instanceof Error ? error.message : String(error))
      })
    const off = window.anvil.updates.onStatus((next) => {
      setSnapshot(next)
    })
    return () => {
      mounted = false
      off()
    }
  }, [])

  async function check() {
    if (!window.anvil?.updates) return
    try {
      const next = await window.anvil.updates.check()
      setSnapshot(next)
      if (next.status === 'not-available') {
        onNoticeRef.current('当前已是最新版本')
      } else if (next.status === 'error' && next.message) {
        onErrorRef.current(next.message)
      }
    } catch (error: unknown) {
      onErrorRef.current(error instanceof Error ? error.message : String(error))
    }
  }

  async function download() {
    if (!window.anvil?.updates) return
    try {
      const next = await window.anvil.updates.download()
      setSnapshot(next)
      if (next.status === 'error' && next.message) {
        onErrorRef.current(next.message)
      }
    } catch (error: unknown) {
      onErrorRef.current(error instanceof Error ? error.message : String(error))
    }
  }

  async function install() {
    if (!window.anvil?.updates) return
    try {
      const result = await window.anvil.updates.install()
      if (!result.ok && result.error) onErrorRef.current(result.error)
    } catch (error: unknown) {
      onErrorRef.current(error instanceof Error ? error.message : String(error))
    }
  }

  return { snapshot, check, download, install }
}
