import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export function getClaudeExecutablePath(): string | undefined {
  if (!app.isPackaged) return undefined

  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const platformPackage =
    process.platform === 'win32' ? `claude-agent-sdk-win32-${arch}` :
    process.platform === 'darwin' ? `claude-agent-sdk-darwin-${arch}` :
    process.platform === 'linux' ? `claude-agent-sdk-linux-${arch}` :
    null

  if (!platformPackage) return undefined

  const appPath = app.getAppPath()
  const unpackedAppPath = appPath.endsWith('.asar') ? `${appPath}.unpacked` : appPath
  const executableName = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const executablePath = path.join(
    unpackedAppPath,
    'node_modules',
    '@anthropic-ai',
    platformPackage,
    executableName,
  )

  if (!fs.existsSync(executablePath)) {
    console.warn('[Claude SDK] Packaged native executable not found:', executablePath)
    return undefined
  }

  return executablePath
}
