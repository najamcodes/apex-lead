// electron/scraper/google-maps.ts
// Scrapes Google Maps search results for a given query + city.
// Returns an array of RawMapListing objects.

import type { BrowserContext } from 'playwright'
import type { RawMapListing } from '../../src/types/scraper.types'

const MAPS_BASE = 'https://www.google.com/maps/search'

const SELECTORS = {
  results_panel:  'div[role="feed"]',
  result_item:    'a[href*="/maps/place/"]',
  result_name:    'div.fontHeadlineSmall',
  category:       'div.fontBodyMedium span:first-child',
  address:        'div.fontBodyMedium span[aria-label*="Address"]',
  phone:          'div.fontBodyMedium span[aria-label*="Phone"]',
  website_btn:    'a[data-item-id="authority"]',
  rating:         'div.fontBodyMedium span[aria-label*="stars"]',
}

function parseRating(text: string | null): number | null {
  if (!text) return null
  const match = text.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : null
}

function extractCityFromAddress(address: string, fallbackCity: string): string {
  // Try to extract city from address string — rough heuristic
  const parts = address.split(',').map((p) => p.trim())
  return parts.length >= 2 ? parts[parts.length - 2] : fallbackCity
}

export async function scrapeGoogleMaps(
  context: BrowserContext,
  query: string,
  city: string,
  maxResults: number,
  onProgress: (found: number, current: string) => void,
  cancelToken: { cancelled: boolean }
): Promise<RawMapListing[]> {
  const page = await context.newPage()
  const results: RawMapListing[] = []

  try {
    const searchQuery = encodeURIComponent(`${query} in ${city}`)
    await page.goto(`${MAPS_BASE}/${searchQuery}`, { waitUntil: 'networkidle', timeout: 30000 })

    // Wait for results feed
    await page.waitForSelector(SELECTORS.results_panel, { timeout: 15000 })

    // Scroll to load more results
    const feed = page.locator(SELECTORS.results_panel)
    let lastCount = 0
    let scrollAttempts = 0
    const MAX_SCROLL = 20

    while (results.length < maxResults && scrollAttempts < MAX_SCROLL) {
      if (cancelToken.cancelled) break

      // Get all visible result links
      const links = await page.locator(SELECTORS.result_item).all()

      for (let i = lastCount; i < links.length && results.length < maxResults; i++) {
        if (cancelToken.cancelled) break

        try {
          await links[i].click()
          await page.waitForTimeout(1200 + Math.random() * 800) // human-like delay

          // Extract data from the detail panel
          const name = await page.locator(SELECTORS.result_name).first().textContent().catch(() => null)
          if (!name) continue

          const category = await page.locator(SELECTORS.category).first().textContent().catch(() => null)
          const addressText = await page.locator(SELECTORS.address).first().textContent().catch(() => null)
          const phone = await page.locator(SELECTORS.phone).first().textContent().catch(() => null)
          const websiteHref = await page.locator(SELECTORS.website_btn).first().getAttribute('href').catch(() => null)
          const ratingText = await page.locator(SELECTORS.rating).first().getAttribute('aria-label').catch(() => null)
          const mapsUrl = page.url()

          results.push({
            business_name: name.trim(),
            category: category?.trim() ?? '',
            address: addressText?.trim() ?? '',
            city: addressText ? extractCityFromAddress(addressText, city) : city,
            phone: phone?.trim() ?? null,
            website_url: websiteHref ?? null,
            google_maps_url: mapsUrl,
            rating: parseRating(ratingText),
            review_count: null,
          })

          onProgress(results.length, name.trim())
        } catch {
          // Skip this listing silently — don't abort the whole run
        }
      }

      lastCount = links.length

      // Scroll the feed to load more
      await feed.evaluate((el) => el.scrollBy(0, 600))
      await page.waitForTimeout(800)
      scrollAttempts++

      // Check if we've reached the end
      const endText = await page.locator('text=You\'ve reached the end').count()
      if (endText > 0) break
    }
  } finally {
    await page.close()
  }

  return results
}
