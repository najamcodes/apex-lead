// electron/outreach/sequence-engine.ts
// Builds the 3-step follow-up sequence for an approved lead.
// Step 1: immediately (or scheduled_at provided)
// Step 2: 3 days after step 1 sent
// Step 3: 14 days after step 1 sent

import { addDays, formatISO } from 'date-fns'
import { insertOutreach, getOutreachByLead } from '../../src/db/queries/outreach.queries'
import type { OutreachRecord } from '../../src/types/outreach.types'

export interface SequenceInput {
  lead_id: number
  email: string
  subject: string
  email_body: string
  send_immediately?: boolean
}

// Follow-up message templates — brief, human, references prior contact
function buildFollowUp(step: 2 | 3, businessName: string, _originalSubject: string): string {
  if (step === 2) {
    return `Hi,

Just wanted to follow up on my previous message about ${businessName}'s online presence.

I know things get busy — happy to answer any questions or share a quick preview of what a modern site could look like for your business.

Let me know if you'd like to chat.`
  }

  return `Hi,

Last follow-up from me — I reached out a couple weeks ago about ${businessName}'s website.

If the timing isn't right, no worries at all. Feel free to reach out whenever it makes sense.

Wishing you a great week.`
}

export function scheduleSequence(
  input: SequenceInput,
  businessName: string
): OutreachRecord[] {
  // Check if sequence already exists for this lead
  const existing = getOutreachByLead(input.lead_id)
  if (existing.length > 0) {
    throw new Error(`Sequence already exists for lead ${input.lead_id}`)
  }

  const now = new Date()
  const step1Date = input.send_immediately ? now : addDays(now, 0)
  const step2Date = addDays(step1Date, 3)
  const step3Date = addDays(step1Date, 14)

  const records: OutreachRecord[] = []

  // Step 1 — initial email
  records.push(insertOutreach({
    lead_id:      input.lead_id,
    step:         1,
    channel:      'email',
    subject:      input.subject,
    body:         input.email_body,
    scheduled_at: formatISO(step1Date),
  }))

  // Step 2 — day 3 follow-up
  records.push(insertOutreach({
    lead_id:      input.lead_id,
    step:         2,
    channel:      'email',
    subject:      `Re: ${input.subject}`,
    body:         buildFollowUp(2, businessName, input.subject),
    scheduled_at: formatISO(step2Date),
  }))

  // Step 3 — day 14 final touch
  records.push(insertOutreach({
    lead_id:      input.lead_id,
    step:         3,
    channel:      'email',
    subject:      `Re: ${input.subject}`,
    body:         buildFollowUp(3, businessName, input.subject),
    scheduled_at: formatISO(step3Date),
  }))

  return records
}
