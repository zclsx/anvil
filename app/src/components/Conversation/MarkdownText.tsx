import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { markdownComponents } from '../../lib/markdown'

export function MarkdownText({ text }: { text: string }) {
  return (
    <div className="text-on-surface text-[13px] leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={markdownComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
