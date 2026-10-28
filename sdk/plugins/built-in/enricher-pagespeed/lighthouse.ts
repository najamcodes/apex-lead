import * as chromeLauncher from 'chrome-launcher'
import type { PageSpeedResult } from '@sdk/core/types'

export async function runLighthouse(websiteUrl: string): Promise<PageSpeedResult> {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] })
  const options = {
    logLevel: 'error' as const,
    output: 'json' as const,
    onlyCategories: ['performance', 'seo', 'accessibility'],
    port: chrome.port
  }
  
  try {
    const lighthouse = (await import('lighthouse')).default
    const runnerResult = await lighthouse(websiteUrl, options)
    const report = runnerResult?.lhr
    
    if (!report) {
      throw new Error('No Lighthouse report generated')
    }

    const cats = report.categories
    const audits = report.audits

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

    return {
      mobile_score: score,
      desktop_score: score, // local lighthouse uses a single run by default
      fcp_ms: fcp,
      lcp_ms: lcp,
      cls: cls,
      tbt_ms: tbt,
      seo_metrics: failedMetrics.length > 0 ? JSON.stringify(failedMetrics.slice(0, 5)) : null,
      fetched_at: new Date().toISOString()
    }
  } finally {
    if (chrome) {
      try {
        await chrome.kill()
      } catch {}
    }
  }
}
