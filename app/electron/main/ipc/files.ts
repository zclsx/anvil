import { shell, type IpcMain } from 'electron'
import { getSettings } from '../settings'
import { listSessions } from '../db'
import {
  type DocxBytesResult,
  validateDocxPath,
  isRegularDocxFile,
  resolveDocxReadPath,
} from '../query/docxRead'

export interface FileActionResult {
  ok: boolean
  error?: string
}

function knownWorkspaceRoots(): string[] {
  const roots = new Set<string>()
  const configured = getSettings().workspacePath
  if (configured) roots.add(configured)
  for (const session of listSessions()) {
    if (session.workspacePath) roots.add(session.workspacePath)
  }
  return Array.from(roots)
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
    return resolveDocxReadPath(filePath, knownWorkspaceRoots())
  })
}
