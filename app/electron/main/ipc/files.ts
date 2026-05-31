import { promises as fs } from 'node:fs'
import path from 'node:path'
import { shell, type IpcMain } from 'electron'

export interface FileActionResult {
  ok: boolean
  error?: string
}

export interface DocxBytesResult {
  ok: boolean
  bytes?: Uint8Array
  error?: string
}

const MAX_PREVIEW_BYTES = 25 * 1024 * 1024

/**
 * Validate a path the renderer asked us to open/reveal. The renderer can't
 * touch the filesystem directly, so this is the trust boundary: absolute
 * path, must exist, and (first version) must be a .docx we generated.
 */
function validateDocxPath(filePath: unknown): string | null {
  if (typeof filePath !== 'string') return null
  if (!path.isAbsolute(filePath)) return null
  if (path.extname(filePath).toLowerCase() !== '.docx') return null
  return filePath
}

/**
 * The IPC is an independent entry point, so harden it beyond "exists": the
 * target must be a regular file (not a directory named `x.docx`) and not a
 * symlink (which could point outside the workspace).
 */
async function isRegularDocxFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.lstat(filePath)
    return stat.isFile() && !stat.isSymbolicLink()
  } catch {
    return false
  }
}

export function registerFilesIpc(ipcMain: IpcMain): void {
  ipcMain.handle('files:open-path', async (_e, filePath: unknown): Promise<FileActionResult> => {
    const valid = validateDocxPath(filePath)
    if (!valid) return { ok: false, error: '无效的文件路径' }
    if (!(await isRegularDocxFile(valid))) return { ok: false, error: '文件不存在或不是普通文件' }
    const error = await shell.openPath(valid)
    if (error) return { ok: false, error }
    return { ok: true }
  })

  ipcMain.handle('files:show-in-folder', async (_e, filePath: unknown): Promise<FileActionResult> => {
    const valid = validateDocxPath(filePath)
    if (!valid) return { ok: false, error: '无效的文件路径' }
    if (!(await isRegularDocxFile(valid))) return { ok: false, error: '文件不存在或不是普通文件' }
    shell.showItemInFolder(valid)
    return { ok: true }
  })

  ipcMain.handle('files:read-docx-bytes', async (_e, filePath: unknown): Promise<DocxBytesResult> => {
    const valid = validateDocxPath(filePath)
    if (!valid) return { ok: false, error: '无效的文件路径' }
    if (!(await isRegularDocxFile(valid))) return { ok: false, error: '文件不存在或不是普通文件' }
    try {
      const stat = await fs.stat(valid)
      if (stat.size > MAX_PREVIEW_BYTES) return { ok: false, error: '文档过大，无法预览' }
      const buf = await fs.readFile(valid)
      return { ok: true, bytes: new Uint8Array(buf) }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })
}
