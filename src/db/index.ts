// src/db/index.ts
// DB singleton. Import this anywhere in the MAIN process. Never in renderer.

import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { SCHEMA_SQL } from './schema'
import { runMigrations } from './migrations'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  const dbPath = path.join(app.getPath('userData'), 'leadhunter.db')
  _db = new Database(dbPath)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  _db.exec(SCHEMA_SQL)
  runMigrations(_db)
  return _db
}
