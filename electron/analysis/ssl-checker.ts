// electron/analysis/ssl-checker.ts
import { createStealthContext } from '../scraper/stealth'
import type { SslResult } from '../../src/types/analysis.types'
import { getSettings } from '../../src/db/queries/settings.queries'

export async function checkSsl(websiteUrl: string): Promise<SslResult> {
  // Normalize URL
  let url: URL
  try {
    url = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`)
  } catch {
    return {
      ssl_valid: false,
      redirects_to_https: false,
      last_modified: null,
      status_code: null,
      is_reachable: false
    }
  }

  const settings = await getSettings()
  const { context } = await createStealthContext(null, !settings.scraper_headful)
  const page = await context.newPage()
  
  try {
    const httpsUrl = `https://${url.hostname}${url.pathname}`
    const response = await page.goto(httpsUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
    
    // Wait a brief moment for dynamic content
    await page.waitForTimeout(2000).catch(() => {})
    
    if (!response) {
      throw new Error('No response')
    }

    const headers = response.headers()
    const lastModified = headers['last-modified'] ?? null
    const finalUrl = page.url()

    // Extract homepage content
    const site_content = await extractPageText(page)
    
    // Look for About/Contact/Team page
    const contactUrl = await findContactPage(page)
    let contact_page_content: string | null = null
    if (contactUrl) {
      try {
        await page.goto(contactUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
        await page.waitForTimeout(1500).catch(() => {})
        contact_page_content = await extractPageText(page)
      } catch {
        // ignore errors on secondary page
      }
    }

    // Look for social links
    const social_links = await extractSocialLinks(page)

    await context.close()

    return {
      ssl_valid: finalUrl.startsWith('https://'),
      redirects_to_https: finalUrl.startsWith('https://'),
      last_modified: lastModified,
      status_code: response.status(),
      is_reachable: response.ok(),
      site_content,
      contact_page_content,
      social_links
    }
  } catch {
    try {
      // Fallback to HTTP
      const httpUrl = `http://${url.hostname}${url.pathname}`
      const response = await page.goto(httpUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
      
      await page.waitForTimeout(2000).catch(() => {})

      if (!response) throw new Error('No response')

      const headers = response.headers()
      const finalUrl = page.url()

      // Extract homepage content
      const site_content = await extractPageText(page)
      
      // Look for About/Contact/Team page
      const contactUrl = await findContactPage(page)
      let contact_page_content: string | null = null
      if (contactUrl) {
        try {
          await page.goto(contactUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
          await page.waitForTimeout(1500).catch(() => {})
          contact_page_content = await extractPageText(page)
        } catch {}
      }

      // Look for social links
      const social_links = await extractSocialLinks(page)

      await context.close()

      return {
        ssl_valid: false,
        redirects_to_https: finalUrl.startsWith('https://'),
        last_modified: headers['last-modified'] ?? null,
        status_code: response.status(),
        is_reachable: response.ok(),
        site_content,
        contact_page_content,
        social_links
      }
    } catch {
      await context.close().catch(() => {})
      return {
        ssl_valid: false,
        redirects_to_https: false,
        last_modified: null,
        status_code: null,
        is_reachable: false,
        site_content: null,
        contact_page_content: null,
        social_links: null
      }
    }
  }
}

// Estimate build year from Last-Modified header
export function estimateBuildYear(lastModified: string | null): number | null {
  if (!lastModified) return null
  const d = new Date(lastModified)
  if (isNaN(d.getTime())) return null
  return d.getFullYear()
}

// Extract visible text from the page body
async function extractPageText(page: any): Promise<string> {
  try {
    const text = await page.evaluate(() => {
      // Remove scripts, styles, noscript, etc before extracting text
      const clone = document.body.cloneNode(true) as HTMLElement
      const elementsToRemove = clone.querySelectorAll('script, style, noscript, iframe, svg, img')
      elementsToRemove.forEach(el => el.remove())
      return clone.innerText || ''
    })
    
    // Clean up whitespace and limit to ~5000 chars to avoid massive token costs
    return text.replace(/\\s+/g, ' ').trim().slice(0, 5000)
  } catch {
    return ''
  }
}

// Find a link that likely goes to About, Team, or Contact
async function findContactPage(page: any): Promise<string | null> {
  try {
    const links = await page.$$eval('a', (els: HTMLAnchorElement[]) => 
      els.map(el => ({ href: el.href, text: el.innerText.toLowerCase() }))
    )
    
    const targetKeywords = ['about', 'team', 'contact', 'who we are', 'our story']
    for (const link of links) {
      if (!link.href || link.href.startsWith('mailto:') || link.href.startsWith('tel:')) continue
      for (const kw of targetKeywords) {
        if (link.text.includes(kw) || link.href.toLowerCase().includes(kw.replace(/\\s+/g, ''))) {
          return link.href
        }
      }
    }
    return null
  } catch {
    return null
  }
}

async function extractSocialLinks(page: any): Promise<Record<string, string> | null> {
  try {
    const links = await page.$$eval('a', (els: HTMLAnchorElement[]) => 
      els.map(el => el.href).filter(h => h && h.startsWith('http'))
    )
    
    const social: Record<string, string> = {}
    
    for (const link of links) {
      try {
        const url = new URL(link)
        const host = url.hostname.toLowerCase()
        if (host.includes('instagram.com') && !social.instagram) social.instagram = link
        if (host.includes('facebook.com') && !social.facebook) social.facebook = link
        if (host.includes('tiktok.com') && !social.tiktok) social.tiktok = link
        if (host.includes('twitter.com') || host.includes('x.com')) {
          if (!social.twitter) social.twitter = link
        }
        if (host.includes('linkedin.com/company') && !social.linkedin) social.linkedin = link
      } catch {}
    }
    
    return Object.keys(social).length > 0 ? social : null
  } catch {
    return null
  }
}
