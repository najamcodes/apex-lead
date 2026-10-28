import { createStealthContext, humanDelay } from '@sdk/core/scraper/stealth'
import { getSettings } from '@sdk/core/db/queries/settings.queries'

export interface LinkedInDorkResult {
  contact_name: string | null
  linkedin_url: string | null
}

export async function searchLinkedInForOwner(
  businessName: string,
  city: string
): Promise<LinkedInDorkResult> {
  let context: any = null

  try {
    const settings = await getSettings().catch(() => ({} as any))
    const proxyConfig = settings?.proxy_enabled
      ? {
          server: settings.proxy_url,
          username: settings.proxy_username || undefined,
          password: settings.proxy_password || undefined,
        }
      : null

    const stealth = await createStealthContext(proxyConfig, !settings?.scraper_headful)
    context = stealth.context
    const page = await context.newPage()

    const query = `site:linkedin.com/in ("Founder" OR "Owner" OR "CEO") "${businessName}" "${city}"`
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await humanDelay(1500, 2500) // human-like pause

    // Check for standard google results
    const results = await page.$$eval('#search .g', (els) => {
      const parsed: { url: string; title: string }[] = []
      for (const el of els) {
        const linkEl = el.querySelector('a')
        const titleEl = el.querySelector('h3')
        if (linkEl && titleEl) {
          parsed.push({
            url: linkEl.href,
            title: titleEl.innerText
          })
        }
      }
      return parsed
    })

    if (results.length > 0) {
      const topResult = results[0]
      if (topResult.url.includes('linkedin.com/in/')) {
        // Extract name from title. E.g. "John Doe - Founder - Company Name | LinkedIn"
        const titleParts = topResult.title.split(' - ')
        let contactName = titleParts[0].trim()
        
        // Ensure we don't accidentally grab a massive string if parsing fails
        if (contactName.length > 40) {
          const words = contactName.split(/\s+/).filter(Boolean)
          contactName = words.slice(0, 2).join(' ') || contactName.slice(0, 40)
        }

        return {
          contact_name: contactName,
          linkedin_url: topResult.url
        }
      }
    }

    return { contact_name: null, linkedin_url: null }
  } catch {
    return { contact_name: null, linkedin_url: null }
  } finally {
    if (context) {
      await context.close().catch(() => {})
    }
  }
}
