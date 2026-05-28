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
  hasWorkspacePath: boolean
  source: 'user' | 'env' | 'default'
}
