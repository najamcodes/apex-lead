// electron/scraper/google-maps.ts
// Autonomous Google Maps scraper.
// Strategy: search URL → collect business URLs → visit each → extract data.

import type { BrowserContext, Page } from 'playwright'
import { humanDelay } from './stealth'
import type { RawMapListing } from '../../src/types/scraper.types'

// ─── URL builder ─────────────────────────────────────────────────────────────

function buildSearchUrl(query: string, city: string): string {
  const q = encodeURIComponent(`${query} ${city}`)
  return `https://www.google.com/maps/search/${q}`
}

// ─── Collect business URLs from the search results panel ─────────────────────

async function collectBusinessUrls(
  page: Page,
  maxResults: number,
  cancelToken: { cancelled: boolean }
): Promise<string[]> {
  const urls = new Set<string>()

  // Wait for the results list to appear
  // Google Maps left panel contains result links — selector is stable
  try {
    await page.waitForSelector('a[href*="/maps/place/"]', {
      timeout: 20000,
      state: 'attached',
    })
  } catch {
    // No results found for this query
    return []
  }

  let noNewResultsCount = 0
  const MAX_SCROLL_ATTEMPTS = 30

  for (let attempt = 0; attempt < MAX_SCROLL_ATTEMPTS; attempt++) {
    if (cancelToken.cancelled) break
    if (urls.size >= maxResults) break

    // Collect all place links currently visible
    const links = await page.$$eval(
      'a[href*="/maps/place/"]',
      (els) => els.map((el) => (el as HTMLAnchorElement).href)
    )

    // Filter to unique, clean URLs
    for (const link of links) {
      if (urls.size >= maxResults) break
      try {
        const url = new URL(link)
        // Only keep /maps/place/ URLs — skip ads and other links
        if (url.pathname.startsWith('/maps/place/')) {
          // Normalize — remove query params that vary per session
          const clean = `${url.origin}${url.pathname}`
          urls.add(clean)
        }
      } catch { /* skip malformed URLs */ }
    }

    const prevSize = urls.size

    // Check for "You've reached the end of the list" indicator
    const endOfList = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'))
      return spans.some(
        (s) =>
          s.textContent?.includes("You've reached the end") ||
          s.textContent?.includes("No more results")
      )
    })

    if (endOfList) break

    // Find the feed and scroll
    const scrolled = await page.evaluate(() => {
      const feeds = Array.from(document.querySelectorAll('div.m6QErb')) as HTMLElement[];
      const feed = document.querySelector('div[role="feed"]') || 
                   feeds.find(f => f.scrollHeight > f.clientHeight && f.querySelector('a[href*="/maps/place/"]'));
      
      if (feed) {
        feed.scrollBy(0, 1500);
        return true;
      }
      // Fallback: try to scroll the first scrollable container we can find
      const anyScrollable = feeds.find(f => f.scrollHeight > f.clientHeight);
      if (anyScrollable) {
        anyScrollable.scrollBy(0, 1500);
        return true;
      }
      return false;
    });

    if (!scrolled) {
      // Native mouse fallback
      const feedHandle = await page.$('div[role="feed"], div.m6QErb:has(a[href*="/maps/place/"])')
      if (feedHandle) {
        try {
          await feedHandle.hover()
        } catch {}
      }
      await page.mouse.wheel(0, 1500)
    }

    // Wait for new results to load after scroll
    await humanDelay(2000, 3500)

    // If no new URLs loaded after scroll, we've hit the end
    if (urls.size === prevSize) {
      noNewResultsCount++
      if (noNewResultsCount >= 5) {
        console.log(`[Scraper] 5 consecutive scrolls yielded no new URLs. Stopping scroll.`)
        break  
      }
    } else {
      noNewResultsCount = 0
    }
  }

  return Array.from(urls).slice(0, maxResults)
}

// ─── Extract data from a single business page ─────────────────────────────────

async function extractBusinessData(
  context: BrowserContext,
  page: Page,
  url: string,
  fallbackCity: string
): Promise<RawMapListing | null> {
  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })

    // Wait for the business name heading — signals the detail panel has loaded
    await page.waitForSelector('h1', { timeout: 10000 }).catch(() => null)

    // Extract all data in one page.evaluate call — faster than multiple queries
    const data = await page.evaluate(() => {
      const getText = (sel: string) =>
        (document.querySelector(sel) as HTMLElement | null)?.innerText?.trim() ?? null

      // Business name — h1 is always the business name on a place page
      const name = getText('h1')

      // Category — appears as a button below the name
      const category =
        getText('button[jsaction*="category"]') ??
        getText('span.DkEaL') ??
        null

      // Address — look for the address button/span
      const addressEl = document.querySelector('[data-item-id="address"]')
      const address = (addressEl as HTMLElement | null)?.innerText?.trim() ?? null

      // Phone — tel: links or phone data attributes
      const phoneLink = document.querySelector('a[href^="tel:"]')
      const phone = phoneLink
        ? (phoneLink as HTMLAnchorElement).href.replace('tel:', '').trim()
        : null

      // Website — external link button
      const websiteEl = document.querySelector(
        'a[data-item-id="authority"], a[href*="website"]'
      ) as HTMLAnchorElement | null
      const website = websiteEl?.href ?? null

      // Email — search for mailto links
      const emailEl = document.querySelector('a[href^="mailto:"]') as HTMLAnchorElement | null
      const email = emailEl ? emailEl.href.replace('mailto:', '').split('?')[0].trim() : null

      // Rating
      const ratingEl = document.querySelector('span[aria-label*="stars"], span[aria-label*="star"]')
      const ratingText = ratingEl?.getAttribute('aria-label') ?? null
      const ratingMatch = ratingText?.match(/[\d.]+/)
      const rating = ratingMatch ? parseFloat(ratingMatch[0]) : null

      // Review count
      const reviewEl = document.querySelector('span[aria-label*="review"]')
      const reviewText = reviewEl?.getAttribute('aria-label') ?? null
      const reviewMatch = reviewText?.match(/[\d,]+/)
      const reviewCount = reviewMatch ? parseInt(reviewMatch[0].replace(',', '')) : null

      return { name, category, address, phone, email, website, rating, reviewCount }
    })

    if (!data.name) return null

    // Extract city from address string
    const city = extractCityFromAddress(data.address, fallbackCity)

    let website_status: string | null = null
    let ssl_valid: boolean | null = null

    const finalWebsiteUrl = data.website ? cleanWebsiteUrl(data.website) : null

    // Check website natively in browser
    if (finalWebsiteUrl) {
      const { ssl_valid: ssl, website_status: status } = await checkWebsiteInBrowser(context, finalWebsiteUrl)
      ssl_valid = ssl
      website_status = status
    }

    return {
      business_name:   data.name,
      category:        data.category ?? '',
      address:         data.address  ?? '',
      city,
      phone:           data.phone,
      email:           data.email,
      website_url:     finalWebsiteUrl,
      website_status,
      ssl_valid,
      google_maps_url: url,
      rating:          data.rating,
      review_count:    data.reviewCount,
    }
  } catch {
    return null
  }
}

// ─── Native Website Checker ───────────────────────────────────────────────────

async function checkWebsiteInBrowser(
  context: BrowserContext,
  url: string
): Promise<{ ssl_valid: boolean | null; website_status: string }> {
  let page: Page | null = null
  try {
    page = await context.newPage()
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    
    if (!response || !response.ok()) {
      return { ssl_valid: false, website_status: 'outdated' }
    }

    const finalUrl = page.url()
    const ssl_valid = finalUrl.startsWith('https://')

    // Basic heuristic for status without AI
    const hasViewport = await page.evaluate(() => {
      return !!document.querySelector('meta[name="viewport"]')
    })

    const website_status = hasViewport ? 'unchecked' : 'outdated'

    await page.close()
    return { ssl_valid, website_status }
  } catch {
    if (page) await page.close().catch(() => {})
    return { ssl_valid: false, website_status: 'outdated' } // broken or unreachable
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractCityFromAddress(address: string | null, fallback: string): string {
  if (!address) return fallback
  // Address format: "Street, City, Region, Country"
  // City is usually the second-to-last part before the country
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    // Return second-to-last part as the most likely city
    return parts[parts.length - 2] ?? fallback
  }
  return fallback
}

function cleanWebsiteUrl(url: string): string {
  try {
    // Google Maps wraps website URLs in a redirect — unwrap it
    const parsed = new URL(url)
    if (parsed.hostname === 'www.google.com' && parsed.pathname === '/url') {
      return parsed.searchParams.get('q') ?? url
    }
    // Return just the origin if it's a Google Maps internal link
    if (parsed.hostname.includes('google.com')) return url
    return `${parsed.origin}`
  } catch {
    return url
  }
}

// ─── Main scrape function ─────────────────────────────────────────────────────

export async function scrapeGoogleMaps(
  context: BrowserContext,
  query: string,
  city: string,
  maxResults: number,
  onProgress: (found: number, current: string) => void,
  cancelToken: { cancelled: boolean }
): Promise<RawMapListing[]> {
  const searchPage = await context.newPage()
  const results: RawMapListing[] = []

  try {
    const searchUrl = buildSearchUrl(query, city)
    console.log(`[Scraper] Loading: ${searchUrl}`)

    // Navigate to search results
    await searchPage.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    // Dismiss consent/cookie dialog if present (EU regions)
    await dismissConsentDialog(searchPage)

    // Wait a moment for JS to render
    await humanDelay(3000, 5000)

    // Collect all business URLs from the results panel
    console.log(`[Scraper] Collecting URLs for up to ${maxResults} results...`)
    const businessUrls = await collectBusinessUrls(searchPage, maxResults, cancelToken)
    console.log(`[Scraper] Found ${businessUrls.length} business URLs`)

    await searchPage.close()

    if (businessUrls.length === 0) {
      console.warn('[Scraper] No business URLs found. Check query or city.')
      return []
    }

    // Visit each business page and extract data
    const detailPage = await context.newPage()

    for (let i = 0; i < businessUrls.length; i++) {
      if (cancelToken.cancelled) break

      const url = businessUrls[i]
      console.log(`[Scraper] Extracting ${i + 1}/${businessUrls.length}: ${url}`)

      const data = await extractBusinessData(context, detailPage, url, city)

      if (data) {
        results.push(data)
        onProgress(results.length, data.business_name)
        console.log(`[Scraper] ✓ ${data.business_name} | ${data.city} | ${data.website_url ?? 'no website'}`)
      } else {
        console.warn(`[Scraper] ✗ Could not extract data from ${url}`)
      }

      // Human-like delay between requests
      await humanDelay(3000, 6000)
    }

    await detailPage.close().catch(() => {})
  } catch (err) {
    console.error('[Scraper] Fatal error:', err)
    await searchPage.close().catch(() => {})
  }

  console.log(`[Scraper] Complete. Extracted ${results.length} leads.`)
  return results
}

// ─── Consent dialog dismisser ─────────────────────────────────────────────────

async function dismissConsentDialog(page: Page): Promise<void> {
  try {
    // Google's consent dialog (shown in EU/some regions)
    const acceptBtn = await page.$(
      'button[aria-label*="Accept"], button[aria-label*="Agree"], ' +
      'form[action*="consent"] button, #L2AGLb, .tHlp8d'
    )
    if (acceptBtn) {
      await acceptBtn.click()
      await humanDelay(800, 1200)
    }
  } catch { /* no dialog — continue */ }
}
