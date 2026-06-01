import type { Item } from '../../store'

export function syntaxHighlightJson(json: string): string {
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
    },
  )
}

export function kindLabel(item: Item): string {
  if (item.kind === 'tool_use') return item.toolName ?? '工具调用'
  if (item.kind === 'tool_result') return '工具结果'
  if (item.kind === 'thinking') return '思考'
  if (item.kind === 'text') return item.role === 'assistant' ? '回复' : '文本'
  return '未知'
}

export function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function previewText(value: unknown): string {
  const text = summarizeValue(value)
  return text.length > 1200 ? `${text.slice(0, 1200)}...` : text
}

export function roleLabel(role: Item['role']): string {
  switch (role) {
    case 'assistant':
      return '助手'
    case 'user':
      return '用户'
    case 'tool':
      return '工具'
    default:
      return role
  }
}

export function errorLabel(value: boolean | undefined): string {
  if (value === true) return '是'
  if (value === false) return '否'
  return '未返回'
}

export function approvalLabel(item: Item): string {
  if (item.approvalDecision === 'allow') return '已允许'
  if (item.approvalDecision === 'deny') return '已拒绝'
  if (item.approvalId) return '等待审批'
  return '无'
}

export function riskLabel(risk: Item['approvalRisk']): string {
  if (risk === 'high') return '高'
  if (risk === 'medium') return '中'
  if (risk === 'low') return '低'
  return '无'
}

function summarizeValue(value: unknown): string {
  if (value == null) return '无'
  if (typeof value === 'string') return value || '空字符串'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    if (typeof value === 'bigint' || typeof value === 'symbol') return value.toString()
    if (typeof value === 'function') return '[function]'
    return Object.prototype.toString.call(value)
  }
}
