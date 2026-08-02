import { getDataSource } from '../../db'
import { logActivity } from '../../db/queries/activity.queries'
import { getSettings } from '../../db/queries/settings.queries'
import { EmailTemplateEntity } from '../../db/entities/EmailTemplateEntity'

// ─── Auto-approve high-scoring leads ─────────────────────────────────────────

export async function autoApproveLeads(threshold: number): Promise<number> {
  const toApprove = await getDataSource().createQueryBuilder()
    .select('id')
    .from('leads', 'leads')
    .where('status IN (:...statuses)', { statuses: ['qualified', 'scraped'] })
    .andWhere('ai_site_score IS NOT NULL')
    .andWhere('ai_site_score >= :threshold', { threshold })
    .getRawMany()

  if (toApprove.length === 0) return 0

  const ids = toApprove.map((r: any) => r.id)
  
  await getDataSource().createQueryBuilder()
    .update('leads')
    .set({
      status: 'approved',
      updated_at: () => "datetime('now')"
    })
    .where('id IN (:...ids)', { ids })
    .execute()

  for (const id of ids) {
    await logActivity(id, 'lead_approved', `Auto-approved (score >= ${threshold})`)
  }

  return ids.length
}

// ─── Auto-schedule sequences ──────────────────────────────────────────────────

export async function autoScheduleSequences(onProgress: (msg: string) => void): Promise<void> {
  const settings = await getSettings()
  if (settings.use_ai_for_outreach && !settings.ai_enabled) return

  let template: EmailTemplateEntity | null = null
  if (!settings.use_ai_for_outreach) {
    if (!settings.default_email_template_id) {
      onProgress('No default email template configured for outreach.')
      return
    }
    template = await getDataSource()
      .getRepository(EmailTemplateEntity)
      .findOneBy({ id: settings.default_email_template_id })
      
    if (!template) {
      onProgress('Default email template not found.')
      return
    }
  }

  const eligibleLeads = await getDataSource().createQueryBuilder()
    .select(['l.id AS id', 'l.business_name AS business_name', 'l.email AS email'])
    .from('leads', 'l')
    .leftJoin('outreach', 'o', 'o.lead_id = l.id')
    .where("l.status = 'approved'")
    .andWhere("l.email IS NOT NULL")
    .andWhere("o.id IS NULL")
    .orderBy('l.updated_at', 'DESC')
    .limit(20)
    .getRawMany()

  if (eligibleLeads.length === 0) return

  onProgress(`Auto-scheduling sequences for ${eligibleLeads.length} approved leads with emails...`)

  const { draftOutreach } = await import('../ai/tasks/draft-outreach')
  const { scheduleSequence } = await import('../outreach/sequence-engine')

  let scheduled = 0
  for (const lead of eligibleLeads) {
    try {
      let draft = { subject: '', email_body: '' }
      if (settings.use_ai_for_outreach) {
        draft = await draftOutreach(
          settings,
          lead.id,
          settings.developer_name || 'Your Name',
          settings.ai_model_email_draft
        )
      } else if (template) {
        draft = { subject: template.subject, email_body: template.body }
      }
      scheduleSequence(
        {
          lead_id:          lead.id,
          email:            lead.email,
          subject:          draft.subject,
          email_body:       draft.email_body,
          send_immediately: false,
        },
        lead.business_name
      )
      logActivity(lead.id, 'sequence_started', 'Auto-scheduled by pipeline')
      scheduled++
    } catch { /* skip individual errors */ }
    await new Promise((r) => setTimeout(r, 500))
  }

  onProgress(`Auto-scheduled ${scheduled} sequences`)
}
