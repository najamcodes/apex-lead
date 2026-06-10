// electron/analysis/pagespeed.ts
// Calls Google PageSpeed Insights API (free, no key needed for basic use,
// key recommended for higher quota — 25,000 req/day free with key).

import fetch from 'node-fetch'
import type { PageSpeedResult } from '../../src/types/analysis.types'

const PSI_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

async function fetchStrategy(
  url: string,
  strategy: 'mobile' | 'desktop',
  apiKey: string
): Promise<{ score: number; fcp: number | null; lcp: number | null; cls: number | null; tbt: number | null }> {
  const params = new URLSearchParams({
    url,
    strategy,
    category: 'performance',
    ...(apiKey ? { key: apiKey } : {}),
  })

  const res = await fetch(`${PSI_BASE}?${params}`, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`PageSpeed API error: ${res.status}`)

  const data = await res.json()
  const cats = data.lighthouseResult?.categories
  const audits = data.lighthouseResult?.audits

  const score = Math.round((cats?.performance?.score ?? 0) * 100)
  const fcp   = audits?.['first-contentful-paint']?.numericValue ?? null
  const lcp   = audits?.['largest-contentful-paint']?.numericValue ?? null
  const cls   = audits?.['cumulative-layout-shift']?.numericValue ?? null
  const tbt   = audits?.['total-blocking-time']?.numericValue ?? null

  return { score, fcp, lcp, cls, tbt }
}

export async function runPageSpeed(
  websiteUrl: string,
  apiKey: string
): Promise<PageSpeedResult> {
  // Run mobile and desktop in parallel
  const [mobile, desktop] = await Promise.all([
    fetchStrategy(websiteUrl, 'mobile', apiKey).catch(() => null),
    fetchStrategy(websiteUrl, 'desktop', apiKey).catch(() => null),
  ])

  return {
    mobile_score:  mobile?.score  ?? 0,
    desktop_score: desktop?.score ?? 0,
    fcp_ms:  mobile?.fcp  ?? null,
    lcp_ms:  mobile?.lcp  ?? null,
    cls:     mobile?.cls  ?? null,
    tbt_ms:  mobile?.tbt  ?? null,
    fetched_at: new Date().toISOString(),
  }
}
