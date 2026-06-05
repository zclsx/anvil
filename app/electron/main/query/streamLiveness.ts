const STREAM_LIVENESS_MESSAGE_TYPES = new Set<unknown>([
  'assistant',
  'user',
  'result',
  'stream_event',
])

export function isStreamLivenessType(rawType: unknown): boolean {
  return STREAM_LIVENESS_MESSAGE_TYPES.has(rawType)
}
