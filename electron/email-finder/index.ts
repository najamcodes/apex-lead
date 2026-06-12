// electron/email-finder/index.ts
import { getDb } from '../../src/db'
import { getSettings } from '../../src/db/queries/settings.queries'
import { logActivity } from '../../src/db/queries/activity.queries'
import { findEmailWithHunter } from './hunter'
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
  const settings = getSettings()
  if (!settings.email_finder_enabled) return null

  const lead = getDb()
    .prepare('SELECT website_url, email FROM leads WHERE id = ?')
    .get(leadId) as any
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
    getDb()
      .prepare('UPDATE leads SET email = ?, updated_at = datetime("now") WHERE id = ?')
      .run(foundEmail, leadId)
    logActivity(leadId, 'email_found', `Found: ${foundEmail}`)
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
