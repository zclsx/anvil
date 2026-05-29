import type { IpcMain } from 'electron'
import {
  deleteSession,
  getLatestSession,
  getSession,
  getSessionEvents,
  listSessions,
  updateSessionWorkspace,
} from '../db'
import { isExistingDirectory, resolveExistingDirectory } from '../query/workspace'

export function registerSessionsIpc(ipcMain: IpcMain): void {
  ipcMain.handle('sessions:list', (_e, workspacePath?: string) => listSessions(workspacePath))
  ipcMain.handle('sessions:get', (_e, sessionId: string) => getSession(sessionId))
  ipcMain.handle('sessions:latest', (_e, workspacePath?: string) => getLatestSession(workspacePath))
  ipcMain.handle('sessions:events', (_e, sessionId: string) => getSessionEvents(sessionId))
  ipcMain.handle('sessions:delete', (_e, sessionId: string) => {
    deleteSession(sessionId)
    return { ok: true }
  })
  ipcMain.handle('sessions:workspace-exists', (_e, workspacePath: string) => ({
    exists: isExistingDirectory(workspacePath),
  }))
  ipcMain.handle('sessions:set-workspace', (_e, sessionId: string, workspacePath: string) => {
    const session = getSession(sessionId)
    if (!session) {
      return { ok: false, error: 'Session 不存在' }
    }
    const normalizedWorkspace = resolveExistingDirectory(workspacePath)
    if (!normalizedWorkspace) {
      return { ok: false, error: `Workspace 不存在或不是目录：${workspacePath}` }
    }
    const updated = updateSessionWorkspace(sessionId, normalizedWorkspace)
    if (!updated) {
      return { ok: false, error: '更新 session workspace 失败' }
    }
    return { ok: true }
  })
}
