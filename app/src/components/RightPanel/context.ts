import { createContext, useContext } from 'react'

export interface RightPanelApi {
  openPreview: (filePath: string, title: string) => void
}

export const RightPanelContext = createContext<RightPanelApi | null>(null)

export function useRightPanel(): RightPanelApi | null {
  return useContext(RightPanelContext)
}
