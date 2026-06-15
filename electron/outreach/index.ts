
import { getDataSource } from '../../src/db'
import { getDueOutreach, updateOutreachStatus, getOutreachById } from '../../src/db/queries/outreach.queries'
import { getEmailAccounts, incrementSentToday, updateEmailAccount } from '../../src/db/queries/email-accounts.queries'
import { sendEmail } from './smtp-sender'
import { parseSpintax } from './spintax'
import { scheduleSequence, type SequenceInput } from './sequence-engine'
import { logActivity } from '../../src/db/queries/activity.queries'
import type { SendResult } from '../../src/types/outreach.types'

let _lastAccountIndex = 0

export async function initSmtp(): Promise<void> {
  // Legacy function. The frontend might still call 'smtp:reinit'.
  // Do nothing, we fetch dynamically.
}


// Send a single outreach record
export async function sendOutreachRecord(recordId: number): Promise<SendResult> {
  const record = await getOutreachById(recordId)
  if (!record) return { success: false, message_id: null, error: 'Record not found' }

  // Get lead email
  const lead = await getDataSource().createQueryBuilder()
    .select(['email', 'business_name'])
    .from('leads', 'leads')
    .where('id = :id', { id: record.lead_id })
    .getRawOne()
  if (!lead?.email) {
    await updateOutreachStatus(recordId, 'failed', { error_message: 'No email address for lead' })
    return { success: false, message_id: null, error: 'No email address on record' }
  }

  // Find an available email account (Round Robin)
  const accounts = await getEmailAccounts()
  const activeAccounts = accounts.filter(a => a.status === 'active' && a.sent_today < a.daily_limit)
  
  if (activeAccounts.length === 0) {
    await updateOutreachStatus(recordId, 'failed', { error_message: 'No active email accounts with remaining daily quota' })
    return { success: false, message_id: null, error: 'No active email accounts with remaining quota' }
  }

  // Round-robin selection
  _lastAccountIndex = (_lastAccountIndex + 1) % activeAccounts.length
  const account = activeAccounts[_lastAccountIndex]

  const parsedSubject = parseSpintax(record.subject ?? '(no subject)')
  const parsedBody = parseSpintax(record.body)

  const result = await sendEmail(account, lead.email, parsedSubject, parsedBody)

  if (result.success) {
    await incrementSentToday(account.id)
    await updateOutreachStatus(recordId, 'sent', {
      sent_at: new Date().toISOString(),
      smtp_message_id: result.message_id ?? undefined
    })
    await logActivity(record.lead_id, 'email_sent', `Step ${record.step} — ${record.subject}`)

    // Advance lead status to 'outreach' if it's still 'approved'
    await getDataSource().createQueryBuilder()
      .update('leads')
      .set({
        status: 'outreach',
        updated_at: () => "datetime('now')"
      })
      .where('id = :id', { id: record.lead_id })
      .andWhere("status = 'approved'")
      .execute()
  } else {
    await updateOutreachStatus(recordId, 'failed', { error_message: result.error ?? undefined })
    if (result.error && result.error.includes('auth')) {
      await updateEmailAccount(account.id, { status: 'error', last_error: result.error } as any)
    }
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
