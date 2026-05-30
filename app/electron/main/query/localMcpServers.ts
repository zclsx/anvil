import { promises as fs } from 'node:fs'

type LocalMcpServerDef = {
  command?: string
  args?: string[]
  env?: Record<string, string>
}

export async function loadLocalMcpServers(): Promise<Record<string, unknown>> {
  const configPath = process.env.ANVIL_LOCAL_MCP_CONFIG
  if (!configPath) return {}
  try {
    const raw = await fs.readFile(configPath, 'utf8')
    const parsed = JSON.parse(raw) as { mcpServers?: Record<string, LocalMcpServerDef> }
    const servers = parsed.mcpServers
    if (!servers || typeof servers !== 'object') return {}
    const result: Record<string, unknown> = {}
    for (const [name, def] of Object.entries(servers)) {
      if (!def || typeof def !== 'object') continue
      result[name] = def.env ? { ...def, env: { ...process.env, ...def.env } } : def
    }
    return result
  } catch {
    return {}
  }
}
