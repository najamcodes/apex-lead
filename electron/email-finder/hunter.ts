// electron/email-finder/hunter.ts
import { getSettings } from '../../src/db/queries/settings.queries'

export async function findEmailWithHunter(domain: string): Promise<string | null> {
  const settings = getSettings()
  if (!settings.hunter_api_key) return null

  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${settings.hunter_api_key}`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()
    const emails = data?.data?.emails

    // Get the most confident generic/personal email
    if (Array.isArray(emails) && emails.length > 0) {
      return emails[0].value
    }
  } catch {
    // Ignore errors, return null
  }

  return null
}
