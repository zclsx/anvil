import { expect, test } from 'vitest'
import { isStreamLivenessType } from '../../electron/main/query/streamLiveness'

test.describe('stream liveness message types', () => {
  test.each(['assistant', 'user', 'result', 'stream_event'])(
    'treats %s as stream liveness',
    (rawType) => {
      expect(isStreamLivenessType(rawType)).toBe(true)
    },
  )

  test.each(['system', 'tool.started', 'tool.result', 'permission_request', undefined, null, 42, {}])(
    'does not treat %s as stream liveness',
    (rawType) => {
      expect(isStreamLivenessType(rawType)).toBe(false)
    },
  )
})
