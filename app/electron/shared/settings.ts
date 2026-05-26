export interface AnvilSettings {
  baseUrl: string
  apiKey: string
  model: string
  stitchProjectId: string
  workspacePath: string
}

export interface PublicSettings {
  baseUrl: string
  hasApiKey: boolean
  apiKeyHint: string
  model: string
  stitchProjectId: string
  workspacePath: string
  source: 'user' | 'env' | 'default'
}
