export type UpdateStatus =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateSnapshot {
  status: UpdateStatus
  enabled: boolean
  currentVersion: string
  feedUrl: string
  version?: string
  releaseName?: string
  message?: string
  percent?: number
  bytesPerSecond?: number
}
