import { createStealthContext, humanDelay } from './stealth'
import { getSettings } from '../../src/db/queries/settings.queries'

export interface LinkedInDorkResult {
  contact_name: string | null
  linkedin_url: string | null
}

export async function searchLinkedInForOwner(
  businessName: string,
  city: string
): Promise<LinkedInDorkResult> {
  const settings = await getSettings()
  const proxyConfig = settings?.proxy_enabled
    ? {
        server: settings.proxy_url,
        username: settings.proxy_username || undefined,
        password: settings.proxy_password || undefined,
      }
    : null

  const { context } = await createStealthContext(proxyConfig, !settings.scraper_headful)
  const page = await context.newPage()
  
  try {
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
          contactName = contactName.split(' ')[0] + ' ' + contactName.split(' ')[1]
        }

        await context.close()
        return {
          contact_name: contactName,
          linkedin_url: topResult.url
        }
      }
    }

    await context.close()
    return { contact_name: null, linkedin_url: null }
  } catch (err) {
    await context.close().catch(() => {})
    return { contact_name: null, linkedin_url: null }
  }
}
