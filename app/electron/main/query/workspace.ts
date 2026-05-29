import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getSession } from '../db'
import type { QueryRequest } from '../../shared/session'

export function normalizeWorkspacePath(workspacePath: string): string {
  let trimmed = workspacePath.trim()
  if (trimmed === '~' || trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    trimmed = path.join(os.homedir(), trimmed.slice(1))
  }
  return path.resolve(trimmed)
}

export function resolveExistingDirectory(dirPath: unknown): string | null {
  if (typeof dirPath !== 'string') return null
  const trimmed = dirPath.trim()
  if (!trimmed) return null
  const normalized = normalizeWorkspacePath(trimmed)
  try {
    return fs.existsSync(normalized) && fs.statSync(normalized).isDirectory()
      ? normalized
      : null
  } catch {
    return null
  }
}

export function isExistingDirectory(dirPath: unknown): boolean {
  return resolveExistingDirectory(dirPath) !== null
}

export function resolveQueryWorkspace(req: QueryRequest): string {
  if (req.mode === 'new') {
    if (!req.workspacePath.trim()) {
      throw new Error('新会话需要先选择 workspace 目录')
    }
    const workspacePath = resolveExistingDirectory(req.workspacePath)
    if (!workspacePath) {
      throw new Error(`Workspace 不存在或不是目录：${req.workspacePath}`)
    }
    return workspacePath
  }

  const session = getSession(req.sessionId)
  if (!session) {
    throw new Error(`Session 不存在：${req.sessionId}`)
  }

  const storedWorkspace = typeof session.workspacePath === 'string' ? session.workspacePath : ''
  if (!storedWorkspace.trim()) {
    throw new Error('该 session 没有 workspace 记录，请重新指定目录')
  }
  const workspacePath = resolveExistingDirectory(storedWorkspace)
  if (!workspacePath) {
    throw new Error(`Workspace 不存在或不是目录：${storedWorkspace}`)
  }
  return workspacePath
}
