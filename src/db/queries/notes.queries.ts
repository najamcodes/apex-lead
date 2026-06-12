import { getDataSource } from '../index'
import { NoteEntity } from '../entities/NoteEntity'
import type { NoteRecord } from '../../types/activity.types'

export async function getNoteByLead(leadId: number): Promise<NoteRecord | null> {
  const repo = getDataSource().getRepository(NoteEntity)
  const res = await repo.findOne({
    where: { lead_id: leadId },
    order: { updated_at: 'DESC' }
  })
  return (res as NoteRecord) || null
}

export async function saveNote(leadId: number, body: string): Promise<NoteRecord> {
  const repo = getDataSource().getRepository(NoteEntity)
  const existing = await getNoteByLead(leadId)

  if (existing) {
    await repo.update(existing.id, { body, updated_at: () => "datetime('now')" })
    return (await getNoteByLead(leadId))!
  }

  const result = await repo.save(repo.create({ lead_id: leadId, body }))
  return result as NoteRecord
}
