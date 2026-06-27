// electron/scraper/engine/result-validator.ts
// Validates, scores, and deduplicates scraped results before DB insert.

import type { RawMapListing } from '../../../../shared/types/scraper.types'

export interface ValidatedListing extends RawMapListing {
  quality_score: number     // 0–100 — how complete the data is
  validation_notes: string[]
}

// Score how complete a listing is
function scoreQuality(listing: RawMapListing): number {
  let score = 0
  if (listing.business_name?.length > 2)  score += 20
  if (listing.phone)                       score += 20
  if (listing.email)                       score += 25
  if (listing.website_url)                 score += 20
  if (listing.city?.length > 1)            score += 10
  if (listing.category?.length > 1)        score +=  5
  return score
}

function isValidBusinessName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 200) return false
  // Reject if it looks like a URL or code
  if (name.startsWith('http') || name.includes('{') || name.includes('<')) return false
  return true
}

function cleanPhone(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return null
  return phone.trim()
}

function cleanWebsite(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    if (u.hostname.length < 4) return null
    if (u.hostname.includes('google.com')) return null
    if (u.hostname.includes('goo.gl')) return null
    return `${u.protocol}//${u.hostname}`
  } catch {
    return null
  }
}

export function validateAndScore(listings: RawMapListing[]): ValidatedListing[] {
  const seen = new Set<string>()
  const results: ValidatedListing[] = []

  for (const listing of listings) {
    const notes: string[] = []

    // Reject invalid business names
    if (!isValidBusinessName(listing.business_name)) {
      console.warn(`[Validator] Rejected: invalid name "${listing.business_name}"`)
      continue
    }

    // Deduplication key: normalized name + city
    const key = `${listing.business_name.toLowerCase().replace(/\s+/g, '')}|${listing.city.toLowerCase()}`
    if (seen.has(key)) {
      console.warn(`[Validator] Duplicate: ${listing.business_name}`)
      continue
    }
    seen.add(key)

    // Clean fields
    const cleaned: RawMapListing = {
      ...listing,
      business_name: listing.business_name.trim(),
      category:      listing.category?.trim() ?? '',
      city:          listing.city?.trim() ?? '',
      phone:         cleanPhone(listing.phone),
      website_url:   cleanWebsite(listing.website_url),
    }

    if (!listing.phone && cleaned.phone) notes.push('Phone cleaned')
    if (!listing.website_url && cleaned.website_url) notes.push('Website cleaned')

    const quality_score = scoreQuality(cleaned)
    results.push({ ...cleaned, quality_score, validation_notes: notes })
  }

  // Sort by quality score — best leads first
  return results.sort((a, b) => b.quality_score - a.quality_score)
}
