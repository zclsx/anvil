import { dialog, type IpcMain } from 'electron'
import type {
  ConfirmRequest,
  ConfirmResponse,
  PickDirectoryRequest,
  PickDirectoryResponse,
} from '../../shared/dialog'
import { resolveExistingDirectory } from '../query/workspace'
import type { MainRuntimeContext } from '../runtimeContext'

export function registerDialogIpc(ipcMain: IpcMain, ctx: MainRuntimeContext): void {
  ipcMain.handle(
    'dialog:confirm',
    async (_e, req: ConfirmRequest): Promise<ConfirmResponse> => {
      const options: Electron.MessageBoxOptions = {
        type: req.destructive ? 'warning' : 'question',
        title: req.title,
        message: req.message,
        detail: req.detail,
        buttons: [req.confirmLabel ?? '确认', req.cancelLabel ?? '取消'],
        defaultId: req.destructive ? 1 : 0,
        cancelId: 1,
        noLink: true,
      }
      const result = ctx.mainWindow
        ? await dialog.showMessageBox(ctx.mainWindow, options)
        : await dialog.showMessageBox(options)
      return { confirmed: result.response === 0 }
    },
  )

  ipcMain.handle(
    'dialog:pickDirectory',
    async (_e, req?: PickDirectoryRequest): Promise<PickDirectoryResponse> => {
      const options: Electron.OpenDialogOptions = {
        title: req?.title ?? '选择 workspace 目录',
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: req?.defaultPath,
      }
      const result = ctx.mainWindow
        ? await dialog.showOpenDialog(ctx.mainWindow, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true, path: null }
      }
      const selectedPath = result.filePaths[0]
      return {
        canceled: false,
        path: selectedPath ? resolveExistingDirectory(selectedPath) : null,
      }
    },
  )
}
