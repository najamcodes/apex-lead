// electron/analysis/ssl-checker.ts
import { getBrowser } from '../scraper/stealth'
import type { SslResult } from '../../src/types/analysis.types'

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

  const browser = await getBrowser()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    const httpsUrl = `https://${url.hostname}${url.pathname}`
    const response = await page.goto(httpsUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
    
    if (!response) {
      throw new Error('No response')
    }

    const headers = response.headers()
    const lastModified = headers['last-modified'] ?? null
    const finalUrl = page.url()

    await context.close()

    return {
      ssl_valid: finalUrl.startsWith('https://'),
      redirects_to_https: finalUrl.startsWith('https://'),
      last_modified: lastModified,
      status_code: response.status(),
      is_reachable: response.ok()
    }
  } catch {
    try {
      // Fallback to HTTP
      const httpUrl = `http://${url.hostname}${url.pathname}`
      const response = await page.goto(httpUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
      
      if (!response) throw new Error('No response')

      const headers = response.headers()
      const finalUrl = page.url()

      await context.close()

      return {
        ssl_valid: false,
        redirects_to_https: finalUrl.startsWith('https://'),
        last_modified: headers['last-modified'] ?? null,
        status_code: response.status(),
        is_reachable: response.ok()
      }
    } catch {
      await context.close().catch(() => {})
      return {
        ssl_valid: false,
        redirects_to_https: false,
        last_modified: null,
        status_code: null,
        is_reachable: false
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
