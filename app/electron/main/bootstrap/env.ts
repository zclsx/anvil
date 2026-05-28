import path from 'node:path'
import { app } from 'electron'
import { config as loadEnv } from 'dotenv'
import { bootstrapFromEnv } from '../settings'

export function loadDevEnv(projectRoot: string): void {
  if (app.isPackaged) return
  loadEnv({ path: path.join(projectRoot, '.env.local') })
  loadEnv({ path: path.join(projectRoot, '.env') })
  bootstrapFromEnv()
}
