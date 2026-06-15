import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { getDataSource } from '../../src/db'
import { getEmailAccounts, getRawEmailAccountById } from '../../src/db/queries/email-accounts.queries'
import { logActivity } from '../../src/db/queries/activity.queries'
import { triageReply } from '../ai/tasks/triage-reply'
import { getSettings } from '../../src/db/queries/settings.queries'
import { sendDiscordAlert } from './discord-bot'

export async function listenForImapReplies() {
  const accounts = await getEmailAccounts()
  const activeAccounts = accounts.filter(a => a.status === 'active')

  for (const account of activeAccounts) {
    checkAccountForReplies(account).catch(err => {
      console.error(`[IMAP] Error checking account ${account.email_address}:`, err)
    })
  }
}

async function checkAccountForReplies(account: import('../../src/types').EmailAccount) {
  const rawAccount = await getRawEmailAccountById(account.id)
  if (!rawAccount) return

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: rawAccount.email_address,
      pass: rawAccount.app_password!
    },
    logger: false
  })

  try {
    await client.connect()
    console.log(`[IMAP] Connected to ${account.email_address}`)

    // Select Inbox
    let lock = await client.getMailboxLock('INBOX')
    try {
      // Find unread messages
      const messages = client.fetch({ seen: false }, { source: true, envelope: true })
      
      for await (const msg of messages) {
        if (!msg.source) continue

        const parsed = await simpleParser(msg.source)
        
        // Try to match message
        const matchedLeadId = await matchReplyToLead(parsed)
        if (matchedLeadId) {
          console.log(`[IMAP] Matched reply from ${parsed.from?.text} to lead ${matchedLeadId}`)
          
          const settings = await getSettings()
          let intent = 'other'
          let summary = 'Reply received'
          let suggested_reply: string | undefined = undefined
          
          if (settings.ai_enabled && settings.openrouter_api_key) {
            const triage = await triageReply(settings.openrouter_api_key, settings.ai_model_site_scoring, parsed.text || '')
            intent = triage.intent
            summary = triage.summary
            suggested_reply = triage.suggested_reply
          }

          // Mark lead and outreach as replied
          await updateLeadStatusToReplied(matchedLeadId, intent, summary, suggested_reply)

          // Send Discord Alert
          if (intent === 'interested' || intent === 'objection') {
            await sendDiscordAlert(matchedLeadId, intent, summary)
          }

          // Mark as read in IMAP
          await client.messageFlagsAdd(msg.seq, ['\\Seen'])
        }
      }
    } finally {
      lock.release()
    }

  } catch (err) {
    throw err
  } finally {
    await client.logout()
  }
}

async function matchReplyToLead(parsed: import('mailparser').ParsedMail): Promise<number | null> {
  const ds = getDataSource()
  
  // 1. Try to match by In-Reply-To or References matching smtp_message_id
  const inReplyTo = parsed.inReplyTo
  if (inReplyTo) {
    const record = await ds.createQueryBuilder()
      .select('lead_id')
      .from('outreach', 'o')
      .where('smtp_message_id = :id', { id: inReplyTo })
      .orWhere('smtp_message_id = :id2', { id2: `<${inReplyTo}>` })
      .getRawOne()
      
    if (record) return record.lead_id
  }

  // 2. Try to match by sender email address
  if (parsed.from && parsed.from.value.length > 0) {
    const senderEmail = parsed.from.value[0].address
    if (senderEmail) {
      const lead = await ds.createQueryBuilder()
        .select('id')
        .from('leads', 'leads')
        .where('email = :email', { email: senderEmail })
        .getRawOne()
        
      if (lead) return lead.id
    }
  }

  return null
}

async function updateLeadStatusToReplied(leadId: number, intent: string, summary: string, suggested_reply?: string) {
  const ds = getDataSource()
  
  // Stop sequence by cancelling any queued outreach
  await ds.createQueryBuilder()
    .update('outreach')
    .set({ status: 'cancelled' })
    .where('lead_id = :leadId', { leadId })
    .andWhere("status = 'queued'")
    .execute()

  let reviewerNotes = `[AI Triage: ${intent}] ${summary}`
  if (suggested_reply) {
    reviewerNotes += `\n\nSuggested Reply:\n${suggested_reply}`
  }

  // Update lead status
  await ds.createQueryBuilder()
    .update('leads')
    .set({
      status: 'replied',
      reviewer_notes: reviewerNotes,
      updated_at: () => "datetime('now')"
    })
    .where('id = :id', { id: leadId })
    .execute()

  await logActivity(leadId, 'email_replied', `Intent: ${intent}. ${summary}`)
}
