// src/db/queries/notes.queries.ts
import { getDb } from '../index'
import type { NoteRecord } from '../../types/activity.types'

export function getNoteByLead(leadId: number): NoteRecord | null {
  return getDb()
    .prepare('SELECT * FROM notes WHERE lead_id = ? ORDER BY updated_at DESC LIMIT 1')
    .get(leadId) as NoteRecord | null
}

export function saveNote(leadId: number, body: string): NoteRecord {
  const db = getDb()
  const existing = getNoteByLead(leadId)

  if (existing) {
    db.prepare(
      `
      UPDATE notes SET body = ?, updated_at = datetime('now') WHERE id = ?
    `
    ).run(body, existing.id)
    return getNoteByLead(leadId)!
  }

  const result = db.prepare('INSERT INTO notes (lead_id, body) VALUES (?, ?)').run(leadId, body)
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid) as NoteRecord
}
