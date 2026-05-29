export type FailureSource =
  | { kind: 'user-cancel' }
  | { kind: 'first-response-timeout'; afterMs: number }
  | { kind: 'idle-timeout'; afterMs: number }
  | { kind: 'hard-timeout'; afterMs: number }
  | { kind: 'api-error' }

export interface NormalizedError {
  status?: number
  code?: string | number
  message: string
  hint: string
  raw: unknown
}

export interface ActiveQuery {
  abort: AbortController
  failure: FailureSource | null
  finishFailed: (source: FailureSource, normalized?: NormalizedError) => void
}

export const FIRST_RESPONSE_TIMEOUT_MS = 15_000
export const STREAM_IDLE_TIMEOUT_MS = 30_000
export const HARD_TIMEOUT_MS = 5 * 60 * 1000

export function normalizeError(err: any): NormalizedError {
  const status: number | undefined =
    err?.status ?? err?.statusCode ?? err?.response?.status ?? err?.cause?.status
  const code = err?.code ?? err?.cause?.code
  const message =
    err?.response?.data?.error?.message ??
    err?.response?.data?.message ??
    err?.body?.error?.message ??
    err?.message ??
    String(err)

  let hint = ''
  if (status === 401 || status === 403) {
    hint = 'API Key 无效、无权限，或额度/账号权限不足'
  } else if (status === 400) {
    hint = '请求参数错误，可能 model / baseUrl / provider 协议不兼容'
  } else if (status === 404) {
    hint = 'endpoint 或 model 不存在'
  } else if (status === 429) {
    hint = '请求过于频繁或额度受限'
  } else if (status && status >= 500) {
    hint = '上游服务错误（5xx）'
  } else if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    hint = '无法连接到 endpoint，请检查 baseUrl / 网络 / 代理'
  } else if (code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    hint = '证书校验失败，请检查 endpoint TLS 配置'
  }

  return { status, code, message, hint, raw: err }
}

export function describeFailure(source: FailureSource, normalized?: NormalizedError): string {
  switch (source.kind) {
    case 'user-cancel':
      return '请求已取消'
    case 'first-response-timeout':
      return `上游 ${source.afterMs / 1000}s 内无响应（first response timeout）。可能是 baseUrl / API key / model 配置错误或服务端无响应`
    case 'idle-timeout':
      return `已开始流式响应但 ${source.afterMs / 1000}s 内无新事件（stream idle timeout）`
    case 'hard-timeout':
      return `请求超过最大执行时长 ${source.afterMs / 1000}s（hard timeout）`
    case 'api-error': {
      const parts: string[] = []
      if (normalized?.status) parts.push(`HTTP ${normalized.status}`)
      if (normalized?.code) parts.push(`code=${normalized.code}`)
      const prefix = parts.length > 0 ? `[${parts.join(' · ')}] ` : ''
      const hint = normalized?.hint ? ` —— ${normalized.hint}` : ''
      return `${prefix}${normalized?.message ?? 'API error'}${hint}`
    }
  }
}
