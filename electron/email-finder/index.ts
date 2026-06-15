// electron/email-finder/index.ts
import { getDataSource } from '../../src/db'
import { getSettings } from '../../src/db/queries/settings.queries'
import { logActivity } from '../../src/db/queries/activity.queries'
import { findEmailWithHunter, verifyEmailWithHunter } from './hunter'
import { guessEmailFromDomain } from './pattern-guesser'

function extractDomain(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url.startsWith('http') ? url : `http://${url}`)
    const domain = parsed.hostname.replace('www.', '')
    return domain
  } catch {
    return null
  }
}

export async function findEmailForLead(leadId: number): Promise<string | null> {
  const settings = await getSettings()
  if (!settings.email_finder_enabled) return null

  const lead = await getDataSource().createQueryBuilder()
    .select(['website_url', 'email'])
    .from('leads', 'leads')
    .where('id = :id', { id: leadId })
    .getRawOne()
  if (!lead) return null

  // Skip if we already have an email
  if (lead.email) return lead.email

  const domain = extractDomain(lead.website_url)
  if (!domain) return null

  // 1. Try Hunter.io
  let foundEmail = await findEmailWithHunter(domain)

  // 2. Fallback to guessing if Hunter fails
  if (!foundEmail) {
    foundEmail = await guessEmailFromDomain(domain)
  }

  // 3. Save if found
  if (foundEmail) {
    await getDataSource().createQueryBuilder()
      .update('leads')
      .set({
        email: foundEmail,
        updated_at: () => "datetime('now')"
      })
      .where('id = :id', { id: leadId })
      .execute()
    await logActivity(leadId, 'email_found', `Found: ${foundEmail}`)
  }

  return foundEmail
}

export async function runEmailFinderBatch(
  leadIds: number[],
  onProgress: (done: number, total: number, leadId: number) => void
): Promise<void> {
  for (let i = 0; i < leadIds.length; i++) {
    try {
      await findEmailForLead(leadIds[i])
    } catch {
      // Ignore errors, don't break batch
    }
    onProgress(i + 1, leadIds.length, leadIds[i])
    // Basic rate limit
    await new Promise((r) => setTimeout(r, 500))
  }
}

export async function verifyEmailForLead(leadId: number): Promise<boolean | null> {
  const lead = await getDataSource().createQueryBuilder()
    .select('email')
    .from('leads', 'leads')
    .where('id = :id', { id: leadId })
    .getRawOne()
  if (!lead || !lead.email) return null

  const isVerified = await verifyEmailWithHunter(lead.email)
  
  if (isVerified !== null) {
    if (isVerified) {
      await getDataSource().createQueryBuilder()
        .update('leads')
        .set({
          email_verified: true,
          updated_at: () => "datetime('now')"
        })
        .where('id = :id', { id: leadId })
        .execute()
      await logActivity(leadId, 'email_found', `Email verified successfully`)
    } else {
      await getDataSource().createQueryBuilder()
        .update('leads')
        .set({
          email_verified: false,
          status: 'skipped',
          flag_reason: 'Invalid Email',
          updated_at: () => "datetime('now')"
        })
        .where('id = :id', { id: leadId })
        .execute()
      await logActivity(leadId, 'lead_skipped', `Email bounced/invalid`)
    }
  }

  return isVerified
}

export async function runEmailVerifierBatch(
  leadIds: number[],
  onProgress: (done: number, total: number, leadId: number) => void
): Promise<void> {
  for (let i = 0; i < leadIds.length; i++) {
    try {
      await verifyEmailForLead(leadIds[i])
    } catch {
      // Ignore
    }
    onProgress(i + 1, leadIds.length, leadIds[i])
    await new Promise((r) => setTimeout(r, 500))
  }
}
