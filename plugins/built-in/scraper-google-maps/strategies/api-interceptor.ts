// electron/scraper/strategies/api-interceptor.ts
// Intercepts Google Maps internal XHR responses to extract raw JSON data.
// Much faster than DOM scraping — gets data before it renders.
// Use as primary strategy; fall back to URL collector if interception fails.

import type { BrowserContext, Route, Request } from 'playwright'
import type { RawMapListing } from '../../../../shared/types/scraper.types'
import { ScrapeControlToken, checkPause } from '../index'

// Google Maps internal API paths that contain business data
const MAPS_DATA_PATTERNS = [
  /\/maps\/search\?/,
  /\/maps\/place\?/,
  /\/maps\/api\/place\//,
  /pb=!1m/,   // Maps protobuf response
]

interface InterceptedBusiness {
  name:        string
  address:     string | null
  phone:       string | null
  website:     string | null
  rating:      number | null
  reviewCount: number | null
  lat:         number | null
  lng:         number | null
  category:    string | null
  placeId:     string | null
  mapsUrl:     string | null
}

// Parse Google Maps protobuf-like JSON response
// The response is a deeply nested array — we fish out the data we need
function parseMapResponse(data: any): InterceptedBusiness[] {
  const results: InterceptedBusiness[] = []

  try {
    // Google Maps returns data as nested arrays — structure varies by query type
    // We recursively search for arrays that look like business listings
    function findBusinessArrays(node: any, depth = 0): void {
      if (depth > 10 || !node) return

      if (Array.isArray(node)) {
        // A business listing array typically has: [name, ...metadata, address, phone, ...]
        // Check if first element looks like a business name string
        if (
          typeof node[0] === 'string' &&
          node[0].length > 2 &&
          node[0].length < 200 &&
          !node[0].startsWith('http')
        ) {
          const candidate = extractFromArray(node)
          if (candidate?.name) results.push(candidate)
        }

        for (const item of node) {
          findBusinessArrays(item, depth + 1)
        }
      } else if (typeof node === 'object') {
        for (const val of Object.values(node)) {
          findBusinessArrays(val, depth + 1)
        }
      }
    }

    findBusinessArrays(data)
  } catch { /* malformed response */ }

  // Deduplicate by name
  const seen = new Set<string>()
  return results.filter((r) => {
    if (seen.has(r.name)) return false
    seen.add(r.name)
    return true
  })
}

function extractFromArray(arr: any[]): InterceptedBusiness | null {
  const name = arr[0]
  if (typeof name !== 'string' || name.length < 2) return null

  // Fish through the array for known data types
  let address: string | null = null, phone: string | null = null, website: string | null = null
  let rating: number | null = null, reviewCount: number | null = null
  let lat: number | null = null, lng: number | null = null, placeId: string | null = null
  const category: string | null = null

  function scanDeep(node: any): void {
    if (!node) return
    if (typeof node === 'string') {
      if (node.match(/^\+?[\d\s\-().]{7,20}$/) && !phone) phone = node
      if (node.startsWith('http') && !node.includes('google') && !website) website = node
      if (node.includes(',') && node.length > 10 && node.length < 200 && !address) address = node
      if (node.startsWith('ChIJ') && node.length > 10) placeId = node
    }
    if (typeof node === 'number') {
      if (node >= 1 && node <= 5 && !rating) rating = node
      if (node > 10 && node < 1_000_000 && !reviewCount) reviewCount = node
      if (Math.abs(node) <= 90 && !lat)  lat = node
      if (Math.abs(node) <= 180 && !lng) lng = node
    }
    if (Array.isArray(node)) node.forEach(scanDeep)
    if (typeof node === 'object') Object.values(node).forEach(scanDeep)
  }

  arr.slice(1).forEach(scanDeep)

  const mapsUrl = placeId
    ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
    : null

  return { name, address, phone, website, rating, reviewCount, lat, lng, category, placeId, mapsUrl }
}

export async function interceptAndCollect(
  context: BrowserContext,
  searchUrl: string,
  maxResults: number,
  cancelToken: ScrapeControlToken
): Promise<RawMapListing[]> {
  const page      = await context.newPage()
  const collected: InterceptedBusiness[] = []

  // Set up response interception
  await context.route('**/*', async (route: Route, request: Request) => {
    // Let the request through
    await route.continue()

    // Only inspect Maps data responses
    if (
      request.resourceType() === 'fetch' ||
      request.resourceType() === 'xhr'
    ) {
      // We can't read response body via route interception in MV3
      // Use page.on('response') instead — see below
    }
  })

  const responseHandler = async (response: any) => {
    const url = response.url()
    if (!MAPS_DATA_PATTERNS.some((p) => p.test(url))) return
    if (response.status() !== 200) return

    try {
      const text = await response.text()
      // Maps responses often start with )]}' to prevent JS hijacking
      const clean = text.replace(/^\)\]\}'\n?/, '')
      if (!clean.startsWith('[') && !clean.startsWith('{')) return

      const data = JSON.parse(clean)
      const businesses = parseMapResponse(data)
      for (const biz of businesses) {
        if (collected.length >= maxResults) return
        if (biz.name) collected.push(biz)
      }
    } catch { /* not JSON */ }
  }

  page.on('response', responseHandler)

  try {
    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout:   30000,
    })

    // Wait a bit for XHR responses to arrive
    await new Promise((r) => setTimeout(r, 5000))

    // Scroll to trigger more data loading
    let scrolled = 0
    while (collected.length < maxResults && scrolled < 20) {
      await checkPause(cancelToken)
      if (cancelToken.cancelled) break

      await page.evaluate(() => {
        const panel = document.querySelector('div[role="feed"]') as HTMLElement | null
        if (panel) panel.scrollTop += 1000
        else window.scrollBy(0, 1000)
      })

      await new Promise((r) => setTimeout(r, 2000))
      scrolled++
    }
  } finally {
    page.off('response', responseHandler)
    await page.close().catch(() => {})
  }

  // Convert to RawMapListing format
  return collected.slice(0, maxResults).map((biz) => ({
    business_name: biz.name,
    category:      biz.category ?? '',
    address:       biz.address  ?? '',
    city:          extractCity(biz.address),
    phone:         biz.phone,
    website_url:   biz.website,
    google_maps_url: biz.mapsUrl,
    rating:        biz.rating,
    review_count:  biz.reviewCount,
    email:         null,
  }))
}

function extractCity(address: string | null): string {
  if (!address) return ''
  const parts = address.split(',').map((s) => s.trim())
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0] ?? ''
}

