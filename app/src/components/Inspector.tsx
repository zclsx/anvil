import type { Item } from '../store'

export function Inspector({ item }: { item: Item }) {
  return (
    <>
      <div className="flex items-center px-4 py-2 border-b border-outline-variant bg-surface-container-low shrink-0">
        <span className="font-mono-code text-[11px] text-on-surface-variant uppercase flex-1">
          Inspector: {item.kind === 'tool_use' ? item.toolName : item.kind}
        </span>
        <button
          onClick={() => navigator.clipboard.writeText(JSON.stringify(item, null, 2))}
          className="px-3 py-1 text-[10px] font-mono-label bg-surface border border-outline-variant text-on-surface hover:text-primary cursor-pointer"
        >
          复制 JSON
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 font-mono-code text-[11px] leading-relaxed text-[#ccc]">
        <pre className="whitespace-pre-wrap">
          {JSON.stringify(item, null, 2)}
        </pre>
      </div>
    </>
  )
}
