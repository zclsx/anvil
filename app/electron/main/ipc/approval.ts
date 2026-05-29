import type { IpcMain } from 'electron'
import type { ApprovalDecision } from '../../shared/session'
import type { MainRuntimeContext } from '../runtimeContext'

export function registerApprovalIpc(ipcMain: IpcMain, ctx: MainRuntimeContext): void {
  ipcMain.handle('approval:decide', (_e, decision: ApprovalDecision) => {
    const resolver = ctx.pendingApprovals.get(decision.approvalId)
    if (!resolver) return { ok: false, error: 'approval not found' }
    ctx.pendingApprovals.delete(decision.approvalId)
    resolver({
      behavior: decision.decision,
      message: decision.reason,
    })
    return { ok: true }
  })
}
