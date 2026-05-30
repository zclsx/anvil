import type { Item } from '../store'

function syntaxHighlightJson(json: string): string {
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'token number'
      if (match.startsWith('"')) {
        if (match.endsWith(':')) {
          cls = 'token property'
        } else {
          cls = 'token string'
        }
      } else if (match === 'true' || match === 'false') {
        cls = 'token number font-semibold'
      } else if (match === 'null') {
        cls = 'token punctuation opacity-60'
      }

      if (cls === 'token property') {
        return `<span class="${cls}">${match.slice(0, -1)}</span>:`
      }
      return `<span class="${cls}">${match}</span>`
    }
  )
}

export function Inspector({ item }: { item: Item }) {
  const jsonString = JSON.stringify(item, null, 2)
  const highlightedHtml = syntaxHighlightJson(jsonString)

  return (
    <>
      <div className="flex items-center px-4 py-2 border-b border-outline-variant bg-surface-container-low shrink-0">
        <span className="font-mono-code text-[11px] text-on-surface-variant uppercase flex-1">
          Inspector: {item.kind === 'tool_use' ? item.toolName : item.kind}
        </span>
        <button
          onClick={() => navigator.clipboard.writeText(jsonString)}
          className="px-3 py-1 text-[10px] font-mono-label bg-surface border border-outline-variant text-on-surface hover:text-primary cursor-pointer"
        >
          复制 JSON
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 font-mono-code text-[11px] leading-relaxed text-on-surface">
        <pre
          className="whitespace-pre-wrap select-text"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </div>
    </>
  )
}
