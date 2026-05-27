import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import type { SessionMeta } from '../shared/session'
import type { AgentEventEnvelope } from '../shared/events'

let db: Database.Database | null = null

export function initDb(): Database.Database {
  if (db) return db

  const userData = app.getPath('userData')
  fs.mkdirSync(userData, { recursive: true })
  const dbPath = path.join(userData, 'anvil.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      workspace_path TEXT NOT NULL,
      title TEXT NOT NULL,
      first_prompt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_status TEXT NOT NULL,
      turn_count INTEGER NOT NULL DEFAULT 0,
      total_cost_usd REAL NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_path, updated_at DESC);

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, seq);
  `)

  return db
}

function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function upsertSession(meta: SessionMeta): void {
  getDb()
    .prepare(
      `INSERT INTO sessions (id, workspace_path, title, first_prompt, created_at, updated_at, last_status, turn_count, total_cost_usd)
       VALUES (@id, @workspacePath, @title, @firstPrompt, @createdAt, @updatedAt, @lastStatus, @turnCount, @totalCostUsd)
       ON CONFLICT(id) DO UPDATE SET
         workspace_path = excluded.workspace_path,
         title = excluded.title,
         updated_at = excluded.updated_at,
         last_status = excluded.last_status,
         turn_count = excluded.turn_count,
         total_cost_usd = excluded.total_cost_usd`,
    )
    .run(meta)
}

export function appendEvent(envelope: AgentEventEnvelope): void {
  const event = envelope.event
  const sessionId = 'sessionId' in event ? event.sessionId : undefined
  if (!sessionId) return

  getDb()
    .prepare(
      `INSERT INTO events (session_id, seq, timestamp, event_type, payload)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      sessionId,
      event.seq,
      event.timestamp,
      event.type,
      JSON.stringify(envelope),
    )
}

export function listSessions(workspacePath?: string): SessionMeta[] {
  const rows = workspacePath
    ? getDb()
        .prepare(
          `SELECT id, workspace_path AS workspacePath, title, first_prompt AS firstPrompt,
                  created_at AS createdAt, updated_at AS updatedAt, last_status AS lastStatus,
                  turn_count AS turnCount, total_cost_usd AS totalCostUsd
           FROM sessions WHERE workspace_path = ? ORDER BY updated_at DESC LIMIT 200`,
        )
        .all(workspacePath)
    : getDb()
        .prepare(
          `SELECT id, workspace_path AS workspacePath, title, first_prompt AS firstPrompt,
                  created_at AS createdAt, updated_at AS updatedAt, last_status AS lastStatus,
                  turn_count AS turnCount, total_cost_usd AS totalCostUsd
           FROM sessions ORDER BY updated_at DESC LIMIT 200`,
        )
        .all()

  return rows as SessionMeta[]
}

export function getSession(sessionId: string): SessionMeta | null {
  const row = getDb()
    .prepare(
      `SELECT id, workspace_path AS workspacePath, title, first_prompt AS firstPrompt,
              created_at AS createdAt, updated_at AS updatedAt, last_status AS lastStatus,
              turn_count AS turnCount, total_cost_usd AS totalCostUsd
       FROM sessions WHERE id = ?`,
    )
    .get(sessionId)
  return (row as SessionMeta) ?? null
}

export function getLatestSession(workspacePath?: string): SessionMeta | null {
  const rows = listSessions(workspacePath)
  return rows[0] ?? null
}

export function getSessionEvents(sessionId: string): AgentEventEnvelope[] {
  const rows = getDb()
    .prepare(
      `SELECT payload FROM events WHERE session_id = ? ORDER BY seq ASC`,
    )
    .all(sessionId) as { payload: string }[]
  return rows.map((r) => JSON.parse(r.payload) as AgentEventEnvelope)
}

export function deleteSession(sessionId: string): void {
  getDb().prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId)
}

export function updateSessionWorkspace(sessionId: string, workspacePath: string): boolean {
  const result = getDb()
    .prepare(`UPDATE sessions SET workspace_path = ?, updated_at = ? WHERE id = ?`)
    .run(workspacePath, new Date().toISOString(), sessionId)
  return result.changes > 0
}

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'anvil.db')
}
