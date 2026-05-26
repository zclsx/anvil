export interface ConfirmRequest {
  title: string
  message: string
  detail?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export interface ConfirmResponse {
  confirmed: boolean
}
