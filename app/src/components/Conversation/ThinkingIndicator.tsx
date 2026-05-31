import { useEffect, useRef, useState } from 'react'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const THINKING_VERBS = ['Thinking', 'Pondering', 'Reasoning', 'Computing']

export function ThinkingIndicator({
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
    elapsed >= dangerAt ? 'text-status-danger' :
    elapsed >= warnAt ? 'text-status-warning' :
    'text-on-surface-variant opacity-70'

  const phaseColor = hasTurnStarted ? 'text-text-primary' : 'text-text-secondary'
  const spinnerColor = hasTurnStarted ? 'text-status-running' : 'text-text-secondary'
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
