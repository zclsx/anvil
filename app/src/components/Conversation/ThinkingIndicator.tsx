import { useEffect, useRef, useState } from 'react'
import { SPINNER_FRAMES } from '../../lib/spinner'

const THINKING_VERBS = ['思考中', '推理中', '整理中', '计算中']

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

  const phaseColor = hasTurnStarted ? 'text-on-surface-variant' : 'text-text-muted'
  const spinnerColor = hasTurnStarted ? 'text-status-running' : 'text-text-muted'
  const label = hasTurnStarted ? THINKING_VERBS[verbIndex] : '连接中'

  return (
    <div
      ref={anchorRef}
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 relative z-10"
    >
      {/* Spinner/Thinking Avatar */}
      <div className="w-12 h-12 rounded-full glass-card flex-shrink-0 flex items-center justify-center border border-secondary/20 shadow-[0_0_15px_rgba(255,255,255,0.05)] bg-secondary/5">
        <span aria-hidden="true" className={`${spinnerColor} text-[18px] font-mono-code leading-none flex items-center justify-center`}>
          {SPINNER_FRAMES[frame]}
        </span>
      </div>
      <div className="flex items-center font-mono-code text-[12px] leading-relaxed opacity-80 min-w-0">
        <span className={phaseColor}>{label}…</span>
        <span aria-hidden="true" className={`${elapsedColor} text-[11px] ml-2`}>
          ({elapsed}s · Esc 或点击「取消」中断)
        </span>
      </div>
    </div>
  )
}
