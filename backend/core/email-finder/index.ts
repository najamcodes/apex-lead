import { getDataSource } from '../../db'
import { logActivity } from '../../db/queries/activity.queries'
import { getSettings } from '../../db/queries/settings.queries'
import { runEnrichers, makeLeadSnapshot } from '../../../plugins/runner'

export async function findEmailForLead(leadId: number): Promise<string | null> {
  const settings = await getSettings()
  if (!settings.email_finder_enabled) return null

  const leadRepo = getDataSource().getRepository("LeadEntity")
  const lead = await leadRepo.findOneBy({ id: leadId })
  if (!lead) return null
  if ((lead as any).email) return (lead as any).email

  const snapshot = makeLeadSnapshot(lead as unknown as Record<string, unknown>)
  // Run the hunter plugin explicitly
  const fields = await runEnrichers(snapshot, ['enricher-hunter'])
  
  if (fields.email) {
    await leadRepo.update(leadId, {
      email: fields.email,
      updated_at: new Date().toISOString()
    })
    await logActivity(leadId, 'email_found', `Found: ${fields.email}`)
    return fields.email as string
  }
  return null
}

export async function runEmailFinderBatch(
  leadIds: number[],
  onProgress: (done: number, total: number, leadId: number) => void
): Promise<void> {
  for (let i = 0; i < leadIds.length; i++) {
    try {
      await findEmailForLead(leadIds[i])
    } catch { }
    onProgress(i + 1, leadIds.length, leadIds[i])
    await new Promise((r) => setTimeout(r, 500))
  }
}

export async function runEmailVerifierBatch(
  leadIds: number[],
  onProgress: (done: number, total: number, leadId: number) => void
): Promise<void> {
  const leadRepo = getDataSource().getRepository('LeadEntity')
  for (let i = 0; i < leadIds.length; i++) {
    try {
      const lead = await leadRepo.findOneBy({ id: leadIds[i] })
      if (lead && (lead as any).email) {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((lead as any).email)
        await leadRepo.update(leadIds[i], {
          email_verified: isValid,
          updated_at: new Date().toISOString(),
        })
      }
    } catch { }
    onProgress(i + 1, leadIds.length, leadIds[i])
    await new Promise((r) => setTimeout(r, 300))
  }
}
