// extension/content/extractor.ts
// Injected into every page. Extracts business data from the DOM.
// Tries structured data first (JSON-LD, meta tags), then heuristics.

import type { ExtractedPageData } from '../shared/types'

// ── Structured data (most reliable) ─────────────────────────────────
function extractJsonLd(): Partial<ExtractedPageData> {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]')
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent ?? '')
      const item = Array.isArray(data) ? data[0] : data
      if (!item) continue

      const result: Partial<ExtractedPageData> = {}

      if (item.name)          result.business_name = item.name
      if (item['@type'])      result.category      = item['@type']
      if (item.telephone)     result.phone         = item.telephone
      if (item.email)         result.email         = item.email

      if (item.address) {
        const addr = typeof item.address === 'string'
          ? item.address
          : [
              item.address.streetAddress,
              item.address.addressLocality,
              item.address.addressRegion,
            ].filter(Boolean).join(', ')
        result.address = addr || null
        result.city    = typeof item.address === 'object' ? (item.address.addressLocality ?? null) : null
      }

      if (result.business_name) return result
    } catch { /* skip malformed JSON-LD */ }
  }
  return {}
}

// ── Meta tags ────────────────────────────────────────────────────────
function extractMeta(): Partial<ExtractedPageData> {
  const get = (name: string) =>
    document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)
      ?.getAttribute('content') ?? null

  return {
    business_name: get('og:site_name') ?? get('og:title') ?? undefined,
  }
}

// ── Title tag heuristics ─────────────────────────────────────────────
function extractFromTitle(): string {
  const title = document.title
  // Strip common suffixes: "Home | BusinessName", "BusinessName – Tag"
  return title
    .replace(/\s*[\|–\-—]\s*.+$/, '')
    .replace(/\s*(Home|Welcome|Official Site|Official Website)\s*/gi, '')
    .trim()
}

// ── Phone number heuristics ──────────────────────────────────────────
function extractPhone(): string | null {
  // Try tel: links first
  const telLink = document.querySelector('a[href^="tel:"]')
  if (telLink) {
    return telLink.getAttribute('href')!.replace('tel:', '').trim()
  }

  // Regex scan visible text — catches most phone formats
  const phoneRegex = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g
  const bodyText = document.body.innerText ?? ''
  const matches = bodyText.match(phoneRegex)
  return matches?.[0]?.trim() ?? null
}

// ── Email heuristics ─────────────────────────────────────────────────
function extractEmail(): string | null {
  // mailto: links
  const mailtoLink = document.querySelector('a[href^="mailto:"]')
  if (mailtoLink) {
    return mailtoLink.getAttribute('href')!.replace('mailto:', '').split('?')[0].trim()
  }

  // Email pattern in visible text
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const bodyText = document.body.innerText ?? ''
  const matches = bodyText.match(emailRegex)
  // Filter out common false positives
  const filtered = matches?.filter((e) =>
    !e.includes('example.com') &&
    !e.includes('sentry.io') &&
    !e.endsWith('.png') &&
    !e.endsWith('.jpg')
  )
  return filtered?.[0] ?? null
}

// ── Address heuristics ───────────────────────────────────────────────
function extractAddress(): { address: string | null; city: string | null } {
  // Look for schema.org address elements
  const addrEl = document.querySelector('[itemprop="address"], [class*="address"], [class*="location"]')
  if (addrEl) {
    const text = (addrEl as HTMLElement).innerText?.trim()
    if (text && text.length < 200) {
      return { address: text, city: null }
    }
  }
  return { address: null, city: null }
}

// ── Main extractor ───────────────────────────────────────────────────
function extractPageData(): ExtractedPageData {
  const jsonLd = extractJsonLd()
  const meta   = extractMeta()
  const addr   = extractAddress()

  const business_name =
    jsonLd.business_name ??
    meta.business_name ??
    extractFromTitle()

  return {
    business_name: business_name || document.title,
    website_url:   window.location.origin,
    phone:         jsonLd.phone    ?? extractPhone(),
    email:         jsonLd.email    ?? extractEmail(),
    address:       jsonLd.address  ?? addr.address,
    city:          jsonLd.city     ?? addr.city,
    category:      jsonLd.category ?? null,
  }
}

// Listen for message from service worker / popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_PAGE_DATA') {
    sendResponse({ type: 'PAGE_DATA', data: extractPageData() })
  }
  return true   // keep channel open for async
})
