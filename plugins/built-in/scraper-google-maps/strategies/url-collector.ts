// electron/scraper/strategies/url-collector.ts
// Scrolls the Google Maps search results panel and harvests all business URLs.

import type { Page } from 'playwright'
import { humanMouseMove, humanScroll } from '@sdk/core/scraper/stealth'
import { AdaptiveThrottler } from '@sdk/core/scraper/engine/adaptive-throttler'
import { detectCaptcha } from '@sdk/core/scraper/engine/captcha-handler'
import { ScrapeControlToken, checkPause } from '../index'

const RESULTS_PANEL_SELECTORS = [
  'div[role="feed"]',
  'div.m6QErb[aria-label]',
  'div.ecceSd',           // alternative Maps layout
  'div.DxyBCb',           // another known container
]

const PLACE_LINK_SELECTOR = 'a[href*="/maps/place/"]'

async function findScrollablePanel(page: Page): Promise<string | null> {
  for (const selector of RESULTS_PANEL_SELECTORS) {
    const exists = await page.$(selector)
    if (exists) {
      // Verify it's actually scrollable
      const scrollable = await page.$eval(selector, (el) => el.scrollHeight > el.clientHeight)
        .catch(() => false)
      if (scrollable) return selector
    }
  }
  return null
}

export async function collectBusinessUrls(
  page: Page,
  maxResults: number,
  cancelToken: ScrapeControlToken,
  throttler: AdaptiveThrottler,
  onProgress?: (collected: number) => void
): Promise<string[]> {
  const urls   = new Set<string>()
  const start  = Date.now()

  // Wait for ANY place link to appear — this is our signal that results loaded
  try {
    await page.waitForSelector(PLACE_LINK_SELECTOR, {
      timeout: 25000,
      state:   'attached',
    })
  } catch {
    // Check if it's a CAPTCHA
    if (await detectCaptcha(page)) {
      throw new Error('CAPTCHA_DETECTED')
    }
    // No results found
    console.warn('[URLCollector] No place links found — empty results for this query')
    return []
  }

  // Find the scrollable container
  const panelSelector = await findScrollablePanel(page)
  console.log(`[URLCollector] Panel selector: ${panelSelector ?? 'none found, using window scroll'}`)

  let   consecutiveEmpty = 0
  const MAX_CONSECUTIVE_EMPTY = 4
  let   scrollPosition   = 0
  const SCROLL_STEP      = 1200

  while (urls.size < maxResults && consecutiveEmpty < MAX_CONSECUTIVE_EMPTY) {
    await checkPause(cancelToken)
    if (cancelToken.cancelled) break

    const beforeSize = urls.size

    // Collect all current place links
    const links = await page.$$eval(PLACE_LINK_SELECTOR, (els) =>
      els.map((el) => (el as HTMLAnchorElement).href)
    ).catch(() => [] as string[])

    for (const href of links) {
      if (urls.size >= maxResults) break
      try {
        const u = new URL(href)
        if (u.pathname.startsWith('/maps/place/')) {
          // Strip query params for deduplication — keep path only
          urls.add(`${u.origin}${u.pathname}`)
        }
      } catch {}
    }

    onProgress?.(urls.size)

    // Detect end-of-list signals
    const endSignals = [
      "You've reached the end",
      "No more results",
      "Didn't find what you were looking for",
    ]
    const pageText = await page.evaluate(() => document.body.innerText).catch(() => '')
    if (endSignals.some((s) => pageText.includes(s))) {
      console.log('[URLCollector] Reached end of results')
      break
    }

    // Scroll to load more
    scrollPosition += SCROLL_STEP
    if (panelSelector) {
      await humanScroll(page, panelSelector, scrollPosition)
    } else {
      await page.evaluate((amt: number) => window.scrollBy(0, amt), SCROLL_STEP)
    }

    // Occasional mouse movement — signals human presence
    if (Math.random() > 0.7) await humanMouseMove(page)

    // Check for CAPTCHA after scroll
    if (await detectCaptcha(page)) {
      throw new Error('CAPTCHA_DETECTED')
    }

    await throttler.wait()

    if (urls.size === beforeSize) {
      consecutiveEmpty++
    } else {
      consecutiveEmpty = 0
    }
  }

  console.log(`[URLCollector] Collected ${urls.size} URLs in ${Date.now() - start}ms`)
  return Array.from(urls).slice(0, maxResults)
}

