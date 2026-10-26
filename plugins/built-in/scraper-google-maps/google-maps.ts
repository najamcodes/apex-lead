// electron/scraper/google-maps.ts
// Main entry point — tries strategies in order, retries on failure.

import type { BrowserContext } from 'playwright'
import { humanDelay } from '@sdk/core/scraper/stealth'
import { ScrapeControlToken, checkPause } from './index'
import { collectBusinessUrls } from './strategies/url-collector'
import { interceptAndCollect }  from './strategies/api-interceptor'
import { extractFromPlacePage } from './extractors/dom-extractor'
import { AdaptiveThrottler }    from '@sdk/core/scraper/engine/adaptive-throttler'
import { detectCaptcha, handleCaptcha } from '@sdk/core/scraper/engine/captcha-handler'
import { validateAndScore }     from './extractors/result-validator'
import { getSettings }          from '../../../backend/db/queries/settings.queries'
import type { RawMapListing }   from '../../../shared/types/scraper.types'

function buildSearchUrl(query: string, city: string): string {
  const q = encodeURIComponent(`${query} in ${city}`)
  return `https://www.google.com/maps/search/${q}`
}

async function dismissConsentDialog(page: any): Promise<void> {
  const selectors = [
    'button[aria-label*="Accept all"]',
    'button[aria-label*="Accept"]',
    'button[aria-label*="Agree"]',
    'form[action*="consent"] button[type="submit"]',
    '#L2AGLb',
    '.tHlp8d',
  ]
  for (const sel of selectors) {
    try {
      const btn = await page.$(sel)
      if (btn) {
        await btn.click()
        await humanDelay(800, 1500)
        return
      }
    } catch {}
  }
}

// ─── Strategy A: URL harvest → visit each place page ─────────────────────────

async function strategyUrlCollect(
  context: BrowserContext,
  query: string,
  city: string,
  maxResults: number,
  cancelToken: ScrapeControlToken,
  throttler: AdaptiveThrottler,
  onProgress: (found: number, current: string) => void
): Promise<RawMapListing[]> {
  console.log('[Strategy A] URL Collector starting...')
  const searchPage = await context.newPage()
  let detailPage: any = null

  try {
    const searchUrl = buildSearchUrl(query, city)
    const t0 = Date.now()

    await searchPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    throttler.recordSuccess(Date.now() - t0)

    await dismissConsentDialog(searchPage)
    await humanDelay(2000, 3500)

    // Check for CAPTCHA immediately after load
    if (await detectCaptcha(searchPage)) {
      const settings = await getSettings().catch(() => ({} as any))
      const result = await handleCaptcha(searchPage, {
        strategy:       (settings?.captcha_strategy as any) ?? 'pause',
        twoCaptchaKey:  settings?.two_captcha_key,
        pauseTimeoutMs: 120_000,
      }, (msg) => onProgress(-1, `⚠ ${msg}`))

      if (result !== 'solved') throw new Error('CAPTCHA_UNRESOLVED')
    }

    // Collect business URLs
    const urls = await collectBusinessUrls(
      searchPage, maxResults, cancelToken, throttler,
      (collected) => onProgress(collected, `Collecting URLs: ${collected}/${maxResults}`)
    )

    await searchPage.close().catch(() => {})
    console.log(`[Strategy A] Collected ${urls.length} URLs`)

    if (urls.length === 0) return []

    // Visit each URL and extract data
    const results: RawMapListing[] = []
    detailPage = await context.newPage()

    for (let i = 0; i < urls.length && !cancelToken.cancelled; i++) {
      await checkPause(cancelToken)
      const t1 = Date.now()
      const data = await extractFromPlacePage(detailPage, urls[i], city)
      throttler.recordSuccess(Date.now() - t1)

      if (data) {
        results.push(data)
        onProgress(results.length, data.business_name)
      } else {
        throttler.recordError()
      }

      await throttler.wait()

      // Re-check for CAPTCHA every 20 requests
      if (i > 0 && i % 20 === 0) {
        if (await detectCaptcha(detailPage)) {
          throw new Error('CAPTCHA_DETECTED_MID_RUN')
        }
      }
    }

    return results
  } finally {
    if (detailPage) await detailPage.close().catch(() => {})
    await searchPage.close().catch(() => {})
  }
}

// ─── Strategy B: XHR interception ────────────────────────────────────────────

async function strategyApiIntercept(
  context: BrowserContext,
  query: string,
  city: string,
  maxResults: number,
  cancelToken: ScrapeControlToken,
  onProgress: (found: number, current: string) => void
): Promise<RawMapListing[]> {
  console.log('[Strategy B] API Interceptor starting...')
  onProgress(0, 'Intercepting Maps API...')

  const searchUrl = buildSearchUrl(query, city)
  const results   = await interceptAndCollect(context, searchUrl, maxResults, cancelToken)

  console.log(`[Strategy B] Intercepted ${results.length} listings`)
  results.forEach((r, i) => onProgress(i + 1, r.business_name))
  return results
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function scrapeGoogleMaps(
  context: BrowserContext,
  query: string,
  city: string,
  maxResults: number,
  onProgress: (found: number, current: string) => void,
  cancelToken: ScrapeControlToken
): Promise<RawMapListing[]> {
  const throttler = new AdaptiveThrottler()
  let   results:  RawMapListing[] = []
  let   strategyUsed = ''

  // Try Strategy B first (faster, no per-page visits)
  try {
    results = await strategyApiIntercept(context, query, city, maxResults, cancelToken, onProgress)
    strategyUsed = 'API Intercept'
  } catch (err) {
    console.warn('[Scraper] Strategy B failed:', err)
  }

  // Fall back to Strategy A if B got < 5 results
  if (results.length < 5 && !cancelToken.cancelled) {
    console.log('[Scraper] Strategy B insufficient — falling back to Strategy A')
    try {
      results = await strategyUrlCollect(
        context, query, city, maxResults,
        cancelToken, throttler, onProgress
      )
      strategyUsed = 'URL Collector'
    } catch (err) {
      console.error('[Scraper] Strategy A failed:', err)
      throw err
    }
  }

  // Validate + deduplicate + score
  const validated = validateAndScore(results)
  console.log(`[Scraper] Done via ${strategyUsed}. Raw: ${results.length}, Validated: ${validated.length}`)

  return validated
}



