import { getSettings } from '@sdk/core/db/queries/settings.queries'

export async function findEmailWithHunter(domain: string, apiKey?: string): Promise<string | null> {
  const settings = await getSettings().catch(() => ({} as any))
  const key = apiKey || settings?.hunter_api_key
  if (!key) return null

  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(key)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null

    const data = (await res.json()) as any
    const emails = data?.data?.emails

    // Get the most confident generic/personal email
    if (Array.isArray(emails) && emails.length > 0 && emails[0]?.value) {
      return String(emails[0].value)
    }
  } catch {
    // Ignore errors, return null
  }

  return null
}

export async function verifyEmailWithHunter(email: string, apiKey?: string): Promise<boolean | null> {
  const settings = await getSettings().catch(() => ({} as any))
  const key = apiKey || settings?.hunter_api_key
  if (!key) return null

  try {
    const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${encodeURIComponent(key)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null

    const data = (await res.json()) as any
    const status = data?.data?.status

    // Hunter returns status: 'valid', 'invalid', 'accept_all', 'webmail', 'disposable', 'unknown'
    if (status === 'valid' || status === 'accept_all') return true
    if (status === 'invalid' || status === 'disposable') return false
    return null // unknown
  } catch {
    return null
  }
}
