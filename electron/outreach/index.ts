// electron/outreach/index.ts
import { getSettings } from '../../src/db/queries/settings.queries'
import { getDataSource } from '../../src/db'
import {
  getDueOutreach,
  updateOutreachStatus,
  getOutreachById
} from '../../src/db/queries/outreach.queries'
import { configureSmtp, sendEmail } from './smtp-sender'
import { scheduleSequence, type SequenceInput } from './sequence-engine'
import { logActivity } from '../../src/db/queries/activity.queries'
import type { SendResult } from '../../src/types/outreach.types'

// Initialize SMTP from saved settings — call on app start and after settings change
export async function initSmtp(): Promise<void> {
  const s = await getSettings()
  if (s.smtp_host && s.smtp_username) {
    configureSmtp({
      host: s.smtp_host,
      port: s.smtp_port || 587,
      secure: s.smtp_secure ?? false,
      username: s.smtp_username,
      password: s.smtp_password,
      from_name: s.smtp_from_name || s.developer_name || 'LeadHunter',
      from_email: s.smtp_from_email || s.smtp_username
    })
  }
}

// Send a single outreach record
export async function sendOutreachRecord(recordId: number): Promise<SendResult> {
  const record = await getOutreachById(recordId)
  if (!record) return { success: false, message_id: null, error: 'Record not found' }

  // Get lead email
  const leads = await getDataSource().query('SELECT email, business_name FROM leads WHERE id = ?', [record.lead_id])
  const lead = leads[0]
  if (!lead?.email) {
    await updateOutreachStatus(recordId, 'failed', { error_message: 'No email address for lead' })
    return { success: false, message_id: null, error: 'No email address on record' }
  }

  const result = await sendEmail(lead.email, record.subject ?? '(no subject)', record.body)

  if (result.success) {
    await updateOutreachStatus(recordId, 'sent', {
      sent_at: new Date().toISOString(),
      smtp_message_id: result.message_id ?? undefined
    })
    await logActivity(record.lead_id, 'email_sent', `Step ${record.step} — ${record.subject}`)

    // Advance lead status to 'outreach' if it's still 'approved'
    await getDataSource().query(
      `UPDATE leads SET status = 'outreach', updated_at = datetime('now') WHERE id = ? AND status = 'approved'`,
      [record.lead_id]
    )
  } else {
    await updateOutreachStatus(recordId, 'failed', { error_message: result.error ?? undefined })
  }

  return result
}

// Send all due outreach records (called by scheduler or manually)
export async function processDueOutreach(): Promise<{ sent: number; failed: number }> {
  const due = await getDueOutreach()
  let sent = 0
  let failed = 0

  for (const record of due) {
    const result = await sendOutreachRecord(record.id)
    if (result.success) sent++
    else failed++
    // 2 second gap between sends — avoids spam triggers
    await new Promise((r) => setTimeout(r, 2000))
  }

  return { sent, failed }
}

// Schedule a full sequence for an approved lead
export function createSequenceForLead(input: SequenceInput, businessName: string) {
  return scheduleSequence(input, businessName)
}
