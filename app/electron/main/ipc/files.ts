import { promises as fs } from 'node:fs'
import path from 'node:path'
import { shell, type IpcMain } from 'electron'

export interface FileActionResult {
  ok: boolean
  error?: string
}

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

async function ensureExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export function registerFilesIpc(ipcMain: IpcMain): void {
  ipcMain.handle('files:open-path', async (_e, filePath: unknown): Promise<FileActionResult> => {
    const valid = validateDocxPath(filePath)
    if (!valid) return { ok: false, error: '无效的文件路径' }
    if (!(await ensureExists(valid))) return { ok: false, error: '文件不存在' }
    const error = await shell.openPath(valid)
    if (error) return { ok: false, error }
    return { ok: true }
  })

  ipcMain.handle('files:show-in-folder', async (_e, filePath: unknown): Promise<FileActionResult> => {
    const valid = validateDocxPath(filePath)
    if (!valid) return { ok: false, error: '无效的文件路径' }
    if (!(await ensureExists(valid))) return { ok: false, error: '文件不存在' }
    shell.showItemInFolder(valid)
    return { ok: true }
  })
}
