import type { ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-outline-variant/70 py-3 last:border-b-0">
      <div className="mb-2 font-label-caps text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {title}
      </div>
      <div className="overflow-hidden border border-outline-variant bg-surface-container-lowest">
        {children}
      </div>
    </section>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] border-b border-outline-variant/70 last:border-b-0">
      <div className="border-r border-outline-variant/70 bg-surface-container-low px-2 py-2 font-mono-label text-[9px] uppercase tracking-wider text-on-surface-variant">
        {label}
      </div>
      <div className="min-w-0 px-2 py-2 font-mono-code text-[10px] leading-relaxed text-on-surface">
        {children}
      </div>
    </div>
  )
}

export function MonoValue({ value }: { value: string }) {
  return <span className="block truncate">{value}</span>
}

export function BlockValue({ value }: { value: string }) {
  return <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-on-surface-variant">{value}</pre>
}
