export interface AnvilSettings {
  baseUrl: string
  apiKey: string
  model: string
  stitchProjectId: string
}

export interface PublicSettings {
  baseUrl: string
  hasApiKey: boolean
  apiKeyHint: string
  model: string
  stitchProjectId: string
  source: 'user' | 'env' | 'default'
}
