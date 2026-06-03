import { Clipboard } from 'lucide-react'
import type { Item } from '../store'
import { BlockValue, MonoValue, Row, Section } from './Inspector/MetadataRows'
import {
  approvalLabel,
  errorLabel,
  formatTime,
  kindLabel,
  previewText,
  riskLabel,
  roleLabel,
  syntaxHighlightJson,
} from './Inspector/format'

export function Inspector({ item }: { item: Item }) {
  const jsonString = JSON.stringify(item, null, 2)
  const highlightedHtml = syntaxHighlightJson(jsonString)
  const itemTitle = kindLabel(item)

  return (
    <>
      <div className="flex shrink-0 items-center border-b border-glass-border bg-glass-surface-muted px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className="font-label-caps text-[10px] font-semibold uppercase tracking-wider text-primary">详情</div>
          <div className="mt-0.5 truncate font-mono-code text-[10px] text-on-surface-variant">
            {itemTitle} / {item.id}
          </div>
        </div>
        <button
          onClick={() => void navigator.clipboard.writeText(jsonString)}
          className="inline-flex cursor-pointer items-center gap-1.5 border border-glass-border bg-glass-surface-strong px-2.5 py-1 font-mono-label text-[10px] text-on-surface transition-colors hover:border-primary hover:text-primary focus-ring"
        >
          <Clipboard size={11} />
          复制 JSON
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-transparent px-4 pb-4 font-mono-code text-[11px] text-on-surface">
        <Section title="项目">
          <Row label="类型"><MonoValue value={itemTitle} /></Row>
          <Row label="角色"><MonoValue value={roleLabel(item.role)} /></Row>
          <Row label="创建"><MonoValue value={formatTime(item.createdAt)} /></Row>
          <Row label="ID"><MonoValue value={item.id} /></Row>
        </Section>

        {item.kind === 'tool_use' && (
          <Section title="工具">
            <Row label="名称"><MonoValue value={item.toolName ?? '未命名工具'} /></Row>
            <Row label="风险"><MonoValue value={riskLabel(item.approvalRisk)} /></Row>
            <Row label="审批"><MonoValue value={approvalLabel(item)} /></Row>
            <Row label="错误"><MonoValue value={errorLabel(item.toolIsError)} /></Row>
            <Row label="输入" isBlock><BlockValue value={previewText(item.toolInput)} /></Row>
            <Row label="输出" isBlock><BlockValue value={previewText(item.toolOutput)} /></Row>
          </Section>
        )}

        {item.text && (
          <Section title="内容">
            <Row label="文本" isBlock><BlockValue value={previewText(item.text)} /></Row>
          </Section>
        )}

        <section className="pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-label-caps text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              原始 JSON
            </span>
            <span className="font-mono-label text-[9px] uppercase tracking-wider text-on-surface-variant">
              次级载荷
            </span>
          </div>
          <pre
            className="code-panel max-h-[48vh] overflow-auto p-3 font-mono-code text-[10px] leading-relaxed select-text"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </section>
      </div>
    </>
  )
}
