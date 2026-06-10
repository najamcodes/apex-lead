// electron/analysis/ssl-checker.ts
import fetch from 'node-fetch'
import type { SslResult } from '../../src/types/analysis.types'

export async function checkSsl(websiteUrl: string): Promise<SslResult> {
  // Normalize URL
  let url: URL
  try {
    url = new URL(
      websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`
    )
  } catch {
    return {
      ssl_valid: false, redirects_to_https: false,
      last_modified: null, status_code: null, is_reachable: false,
    }
  }

  try {
    // Try HTTPS first
    const httpsUrl = `https://${url.hostname}${url.pathname}`
    const res = await fetch(httpsUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    })

    const lastModified = res.headers.get('last-modified')
    const finalUrl = res.url

    return {
      ssl_valid:          finalUrl.startsWith('https'),
      redirects_to_https: finalUrl.startsWith('https'),
      last_modified:      lastModified,
      status_code:        res.status,
      is_reachable:       res.status < 500,
    }
  } catch {
    // HTTPS failed — try HTTP to at least check reachability
    try {
      const httpUrl = `http://${url.hostname}${url.pathname}`
      const res = await fetch(httpUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      })
      return {
        ssl_valid:          false,
        redirects_to_https: res.url.startsWith('https'),
        last_modified:      res.headers.get('last-modified'),
        status_code:        res.status,
        is_reachable:       true,
      }
    } catch {
      return {
        ssl_valid: false, redirects_to_https: false,
        last_modified: null, status_code: null, is_reachable: false,
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
