// electron/email-finder/pattern-guesser.ts
import { promises as dns } from 'node:dns'

async function hasMxRecord(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveMx(domain)
    return records && records.length > 0
  } catch {
    return false
  }
}

export async function guessEmailFromDomain(domain: string): Promise<string | null> {
  // Check if domain can receive email
  const canReceive = await hasMxRecord(domain)
  if (!canReceive) return null

  // We could test SMTP RCPT TO, but many providers block it or return catch-all.
  // Instead, we just guess the most common generic inbox for small businesses:
  return `info@${domain}`
}
