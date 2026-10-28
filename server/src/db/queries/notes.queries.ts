import { getTenantId } from './tenant'
import { getDataSource } from '../index'
import { NoteEntity } from '../entities/NoteEntity'
import type { NoteRecord } from '@sdk/core/types/activity.types'

export async function getNoteByLead(leadId: number): Promise<NoteRecord | null> {
  const repo = getDataSource().getRepository(NoteEntity)
  const res = await repo.findOne({
    where: { lead_id: leadId, org_id: getTenantId() },
    order: { updated_at: 'DESC' }
  })
  return (res as unknown as NoteRecord) || null
}

export async function saveNote(leadId: number, body: string): Promise<NoteRecord> {
  const repo = getDataSource().getRepository(NoteEntity)
  const existing = await getNoteByLead(leadId)

  if (existing) {
    await repo.update(existing.id, { body, updated_at: new Date() })
    return (await getNoteByLead(leadId))!
  }

  const result = await repo.save(repo.create({
    org_id: getTenantId(),
    lead_id: leadId, body }))
  return result as unknown as NoteRecord
}
