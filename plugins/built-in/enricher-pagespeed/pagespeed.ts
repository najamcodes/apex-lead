// electron/analysis/pagespeed.ts
// Calls Google PageSpeed Insights API (free, no key needed for basic use,
// key recommended for higher quota — 25,000 req/day free with key).

import type { PageSpeedResult } from '../../../shared/types/analysis.types'

const PSI_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

async function fetchStrategy(
  url: string,
  strategy: 'mobile' | 'desktop',
  apiKey: string
): Promise<{
  score: number
  fcp: number | null
  lcp: number | null
  cls: number | null
  tbt: number | null
  failedMetrics: string[]
}> {
  const params = new URLSearchParams({
    url,
    strategy,
    ...(apiKey ? { key: apiKey } : {})
  })
  params.append('category', 'performance')
  params.append('category', 'seo')
  params.append('category', 'accessibility')

  const urlStr = `${PSI_BASE}?${params.toString()}`
  const res = await fetch(urlStr, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`PageSpeed API error: ${res.status}`)

  const data = await res.json()
  const cats = data.lighthouseResult?.categories
  const audits = data.lighthouseResult?.audits

  const score = Math.round((cats?.performance?.score ?? 0) * 100)
  const fcp = audits?.['first-contentful-paint']?.numericValue ?? null
  const lcp = audits?.['largest-contentful-paint']?.numericValue ?? null
  const cls = audits?.['cumulative-layout-shift']?.numericValue ?? null
  const tbt = audits?.['total-blocking-time']?.numericValue ?? null

  const failedMetrics: string[] = []
  if (audits) {
    for (const key of Object.keys(audits)) {
      const audit = audits[key]
      if (audit.score !== null && audit.score < 0.5 && audit.details?.type !== 'opportunity') {
        failedMetrics.push(audit.title)
      }
    }
  }

  return { score, fcp, lcp, cls, tbt, failedMetrics }
}

export async function runPageSpeed(websiteUrl: string, apiKey: string): Promise<PageSpeedResult> {
  const targetUrl = websiteUrl.trim().startsWith('http://') || websiteUrl.trim().startsWith('https://')
    ? websiteUrl.trim()
    : `https://${websiteUrl.trim()}`

  // Run mobile and desktop in parallel
  const [mobile, desktop] = await Promise.all([
    fetchStrategy(targetUrl, 'mobile', apiKey).catch(() => null),
    fetchStrategy(targetUrl, 'desktop', apiKey).catch(() => null)
  ])

  // Combine failed metrics from both mobile and desktop (unique)
  const allFailed = Array.from(new Set([
    ...(mobile?.failedMetrics || []),
    ...(desktop?.failedMetrics || [])
  ]))

  return {
    mobile_score: mobile?.score ?? 0,
    desktop_score: desktop?.score ?? 0,
    fcp_ms: mobile?.fcp ?? null,
    lcp_ms: mobile?.lcp ?? null,
    cls: mobile?.cls ?? null,
    tbt_ms: mobile?.tbt ?? null,
    seo_metrics: allFailed.length > 0 ? JSON.stringify(allFailed.slice(0, 5)) : null,
    fetched_at: new Date().toISOString()
  }
}
