import type { ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass-card rounded-xl border border-outline-variant overflow-hidden mb-4">
      <div className="px-4 py-2.5 border-b border-outline-variant bg-surface-container-highest/20 flex items-center gap-2">
        <span className="text-label-caps font-label-caps text-on-surface-variant uppercase tracking-wider text-[10px] font-semibold">{title}</span>
      </div>
      <div className="p-4 space-y-3.5">
        {children}
      </div>
    </section>
  )
}

export function Row({ label, children, isBlock = false }: { label: string; children: ReactNode; isBlock?: boolean }) {
  if (isBlock) {
    return (
      <div className="flex flex-col gap-1.5 py-1">
        <span className="text-label-mono font-label-mono text-on-surface-variant text-[11px] font-medium">{label}</span>
        <div className="min-w-0 text-on-surface">{children}</div>
      </div>
    )
  }

  return (
    <div className="flex justify-between items-center gap-4 min-w-0 py-0.5">
      <span className="text-label-mono font-label-mono text-on-surface-variant text-[11px] shrink-0">{label}</span>
      <div className="min-w-0 flex-grow text-right text-on-surface truncate">
        {children}
      </div>
    </div>
  )
}

export function MonoValue({ value }: { value: string }) {
  return <span className="truncate font-mono-code text-[11px] font-medium block">{value}</span>
}

export function BlockValue({ value }: { value: string }) {
  return (
    <pre className="code-panel max-h-48 overflow-auto p-3 whitespace-pre-wrap break-all font-mono-code text-[10.5px] leading-relaxed w-full">
      {value}
    </pre>
  )
}
