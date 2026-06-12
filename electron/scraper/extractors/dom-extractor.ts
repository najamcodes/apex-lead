// electron/scraper/extractors/dom-extractor.ts
// Extracts maximum data from a Google Maps place page.
// Tries every selector variant — returns the best available data.

import type { Page } from 'playwright'
import type { RawMapListing } from '../../../src/types/scraper.types'

// ── Selector banks ────────────────────────────────────────────────────────────
// Multiple selectors per field — Google Maps A/B tests layouts constantly

const NAME_SELECTORS = [
  'h1.DUwDvf',
  'h1[class*="fontHeadline"]',
  'h1',
]

const CATEGORY_SELECTORS = [
  'button.DkEaL',
  'span.DkEaL',
  'button[jsaction*="category"]',
  'div.skqShb span',
]

const ADDRESS_SELECTORS = [
  '[data-item-id="address"] .Io6YTe',
  '[data-item-id="address"]',
  'button[data-item-id*="address"]',
  'div[aria-label*="Address"]',
]

const PHONE_SELECTORS = [
  'a[href^="tel:"]',
  '[data-item-id*="phone"] .Io6YTe',
  'button[data-item-id*="phone"]',
]

const WEBSITE_SELECTORS = [
  'a[data-item-id="authority"]',
  'a[aria-label*="website" i]',
  'a[data-tooltip*="website" i]',
]



const RATING_SELECTORS = [
  'div.F7nice span[aria-hidden]',
  'span.ceNzKf[aria-label*="star"]',
]

// ── Field extractors ──────────────────────────────────────────────────────────

async function trySelectors(page: Page, selectors: string[]): Promise<string | null> {
  for (const selector of selectors) {
    try {
      const el = await page.$(selector)
      if (!el) continue
      const text = await el.innerText().catch(() => null)
        ?? await el.textContent().catch(() => null)
      if (text?.trim()) return text.trim()
    } catch {}
  }
  return null
}

async function trySelectorsAttr(page: Page, selectors: string[], attr: string): Promise<string | null> {
  for (const selector of selectors) {
    try {
      const val = await page.$eval(selector, (el, a) => el.getAttribute(a), attr).catch(() => null)
      if (val?.trim()) return val.trim()
    } catch {}
  }
  return null
}

export async function extractFromPlacePage(
  page: Page,
  placeUrl: string,
  fallbackCity: string
): Promise<RawMapListing | null> {
  const t0 = Date.now()

  try {
    console.log(`[Extractor] Navigating to: ${placeUrl}`)
    // Navigate to the place URL
    const gotoStart = Date.now()
    await page.goto(placeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch((e) => {
      console.warn(`[Extractor] goto failed for ${placeUrl}:`, e.message)
      return null
    })
    console.log(`[Extractor] goto took ${Date.now() - gotoStart}ms`)

    // Wait for the place page to load — name is the reliable signal
    const waitStart = Date.now()
    await page.waitForSelector('h1', { timeout: 12000 }).catch((e) => {
      console.warn(`[Extractor] wait for h1 failed for ${placeUrl}:`, e.message)
      return null
    })
    console.log(`[Extractor] wait for h1 took ${Date.now() - waitStart}ms`)

    // Extract all fields in parallel
    const [
      name, category, addressText,
      phoneHref, phoneTel, websiteHref,
      ratingAttr, ratingText,
    ] = await Promise.all([
      trySelectors(page, NAME_SELECTORS),
      trySelectors(page, CATEGORY_SELECTORS),
      trySelectors(page, ADDRESS_SELECTORS),
      trySelectorsAttr(page, ['a[href^="tel:"]'], 'href'),
      trySelectors(page, PHONE_SELECTORS),
      trySelectorsAttr(page, WEBSITE_SELECTORS, 'href'),
      trySelectorsAttr(page, RATING_SELECTORS, 'aria-label'),
      trySelectors(page, RATING_SELECTORS),
    ])

    if (!name) return null

    // Clean phone
    const phone = phoneHref
      ? phoneHref.replace('tel:', '').trim()
      : phoneTel ?? null

    // Clean website — unwrap Google redirects
    const website = websiteHref ? cleanUrl(websiteHref) : null

    // Parse rating
    const ratingSource = ratingAttr ?? ratingText
    const ratingMatch  = ratingSource?.match(/[\d.]+/)
    const rating       = ratingMatch ? parseFloat(ratingMatch[0]) : null

    // Review count from aria-label
    const reviewEl = await page.$('span[aria-label*="review"]').catch(() => null)
    const reviewLabel = reviewEl ? await reviewEl.getAttribute('aria-label') : null
    const reviewMatch = reviewLabel?.match(/[\d,]+/)
    const reviewCount = reviewMatch ? parseInt(reviewMatch[0].replace(/,/g, '')) : null

    // Extract city from address
    const city = extractCity(addressText, fallbackCity)

    // Social links
    await page.$$eval('a[href*="instagram.com"], a[href*="facebook.com"]', (els) =>
      els.map((el) => (el as HTMLAnchorElement).href)
    ).catch(() => [] as string[])

    console.log(`[Extractor] ${name} | ${city} | ${phone ?? '—'} | ${website ?? 'no website'} (${Date.now() - t0}ms)`)

    return {
      business_name: name,
      category:      category ?? '',
      address:       addressText ?? '',
      city,
      phone,
      website_url:   website,
      google_maps_url: placeUrl,
      rating,
      review_count:  reviewCount,
      email:         null,
    }
  } catch (err) {
    console.warn(`[Extractor] Failed on ${placeUrl}:`, err)
    return null
  }
}

function cleanUrl(url: string): string {
  try {
    const u = new URL(url)
    // Unwrap Google redirect URLs
    if (u.hostname === 'www.google.com' && u.pathname === '/url') {
      return u.searchParams.get('q') ?? url
    }
    // Return clean origin for Maps internal links
    if (u.hostname.includes('google.com')) return url
    return `${u.protocol}//${u.hostname}`
  } catch {
    return url
  }
}

function extractCity(address: string | null, fallback: string): string {
  if (!address) return fallback
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 3) return parts[parts.length - 2]
  if (parts.length === 2) return parts[0]
  return fallback
}
