import { test, expect } from '@playwright/test'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadLocalMcpServers } from '../../electron/main/query/localMcpServers'

const ENV_KEY = 'ANVIL_LOCAL_MCP_CONFIG'

test.describe('loadLocalMcpServers', () => {
  let tmpDir = ''
  const original = process.env[ENV_KEY]

  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anvil-localmcp-'))
  })
  test.afterAll(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true })
    if (original === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = original
  })

  test('returns empty when the env var is not set', async () => {
    delete process.env[ENV_KEY]
    expect(await loadLocalMcpServers()).toEqual({})
  })

  test('returns empty when the config file is missing', async () => {
    process.env[ENV_KEY] = path.join(tmpDir, 'nope.json')
    expect(await loadLocalMcpServers()).toEqual({})
  })

  test('returns empty on invalid json', async () => {
    const p = path.join(tmpDir, 'bad.json')
    await fs.writeFile(p, '{ not json')
    process.env[ENV_KEY] = p
    expect(await loadLocalMcpServers()).toEqual({})
  })

  test('returns empty when the config has no mcpServers', async () => {
    const p = path.join(tmpDir, 'empty.json')
    await fs.writeFile(p, JSON.stringify({ other: true }))
    process.env[ENV_KEY] = p
    expect(await loadLocalMcpServers()).toEqual({})
  })

  test('loads servers and merges process.env into each server env', async () => {
    const p = path.join(tmpDir, 'mcp.json')
    await fs.writeFile(
      p,
      JSON.stringify({
        mcpServers: {
          demo: { command: 'npx', args: ['-y', 'demo'], env: { DEMO_ID: 'x1' } },
        },
      }),
    )
    process.env[ENV_KEY] = p
    process.env.ANVIL_TEST_MARKER = 'present'
    const servers = (await loadLocalMcpServers()) as Record<
      string,
      { command: string; args: string[]; env: Record<string, string> }
    >
    delete process.env.ANVIL_TEST_MARKER
    expect(servers.demo.command).toBe('npx')
    expect(servers.demo.args).toEqual(['-y', 'demo'])
    expect(servers.demo.env.DEMO_ID).toBe('x1')
    expect(servers.demo.env.ANVIL_TEST_MARKER).toBe('present')
  })
})
