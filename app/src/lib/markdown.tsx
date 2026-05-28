import type { Components } from 'react-markdown'

export const markdownComponents: Components = {
  p: ({ node: _node, ...props }) => (
    <p className="mb-2 last:mb-0" {...props} />
  ),
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold text-primary" {...props} />
  ),
  em: ({ node: _node, ...props }) => (
    <em className="italic text-on-surface" {...props} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="my-2 list-disc pl-5" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="my-2 list-decimal pl-5" {...props} />
  ),
  li: ({ node: _node, ...props }) => (
    <li className="my-1 pl-1" {...props} />
  ),
  a: ({ node: _node, ...props }) => (
    <a className="text-[#8ab4ff] underline underline-offset-2 hover:text-primary" target="_blank" rel="noreferrer" {...props} />
  ),
  code: ({ node: _node, className, ...props }) => (
    <code className={`font-mono-code text-[0.92em] bg-surface-container-high px-1 py-0.5 rounded ${className ?? ''}`} {...props} />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre className="my-2 overflow-x-auto border border-outline-variant bg-surface-container p-3 font-mono-code text-[11px] leading-relaxed" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="my-2 border-l-2 border-outline-variant pl-3 text-on-surface-variant" {...props} />
  ),
  hr: ({ node: _node, ...props }) => (
    <hr className="my-3 border-outline-variant" {...props} />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]" {...props} />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th className="border border-outline-variant bg-surface-container px-2 py-1 text-left font-semibold" {...props} />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="border border-outline-variant px-2 py-1 align-top" {...props} />
  ),
}
