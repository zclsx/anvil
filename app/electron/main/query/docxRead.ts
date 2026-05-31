import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface DocxBytesResult {
  ok: boolean
  bytes?: Uint8Array
  error?: string
}

export const MAX_PREVIEW_BYTES = 25 * 1024 * 1024

export function validateDocxPath(filePath: unknown): string | null {
  if (typeof filePath !== 'string') return null
  if (!path.isAbsolute(filePath)) return null
  if (path.extname(filePath).toLowerCase() !== '.docx') return null
  return filePath
}

export async function isRegularDocxFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.lstat(filePath)
    return stat.isFile() && !stat.isSymbolicLink()
  } catch {
    return false
  }
}

async function isWithinAnyRoot(absPath: string, roots: string[]): Promise<boolean> {
  let realTarget: string
  try {
    realTarget = await fs.realpath(absPath)
  } catch {
    return false
  }
  for (const root of roots) {
    if (!root) continue
    try {
      const realRoot = await fs.realpath(root)
      const rel = path.relative(realRoot, realTarget)
      if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) return true
    } catch {
      // unreadable root — skip
    }
  }
  return false
}

/**
 * Reading file bytes into the renderer is a stronger permission than open/reveal
 * (which only hand the path to the OS). So this boundary is tighter: besides
 * abs + .docx + regular-non-symlink + size cap, the target must resolve inside one
 * of the app's known workspace roots. `roots` is supplied by the main process
 * (settings + session workspaces), never trusted from the renderer.
 */
export async function resolveDocxReadPath(
  filePath: unknown,
  roots: string[],
): Promise<DocxBytesResult> {
  const valid = validateDocxPath(filePath)
  if (!valid) return { ok: false, error: '无效的文件路径' }
  if (!(await isRegularDocxFile(valid))) return { ok: false, error: '文件不存在或不是普通文件' }
  if (!(await isWithinAnyRoot(valid, roots))) return { ok: false, error: '只能预览 workspace 内的文档' }
  try {
    const stat = await fs.stat(valid)
    if (stat.size > MAX_PREVIEW_BYTES) return { ok: false, error: '文档过大，无法预览' }
    const buf = await fs.readFile(valid)
    return { ok: true, bytes: new Uint8Array(buf) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
