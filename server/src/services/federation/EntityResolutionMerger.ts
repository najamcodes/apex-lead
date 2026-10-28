export interface RawDiscoveredLead {
  source: string
  businessName: string
  phone?: string
  website?: string
  address?: string
  city?: string
  state?: string
  rating?: number
  reviews?: number
  licenseNumber?: string
  extra?: Record<string, unknown>
}

export interface UnifiedLeadRecord {
  primaryName: string
  normalizedPhone: string | null
  domain: string | null
  address: string | null
  sources: string[]
  provenance: Record<string, unknown>
  data: Record<string, unknown>
}

export class EntityResolutionMerger {
  /**
   * Calculates Jaro-Winkler string similarity (0.0 to 1.0).
   */
  public static jaroWinkler(s1: string, s2: string): number {
    const a = s1.toLowerCase().trim()
    const b = s2.toLowerCase().trim()
    if (a === b) return 1.0
    if (!a.length || !b.length) return 0.0

    const matchDistance = Math.floor(Math.max(a.length, b.length) / 2) - 1
    const aMatches = new Array(a.length).fill(false)
    const bMatches = new Array(b.length).fill(false)

    let matches = 0
    let transpositions = 0

    for (let i = 0; i < a.length; i++) {
      const start = Math.max(0, i - matchDistance)
      const end = Math.min(i + matchDistance + 1, b.length)
      for (let j = start; j < end; j++) {
        if (bMatches[j] || a[i] !== b[j]) continue
        aMatches[i] = true
        bMatches[j] = true
        matches++
        break
      }
    }

    if (matches === 0) return 0.0

    let k = 0
    for (let i = 0; i < a.length; i++) {
      if (!aMatches[i]) continue
      while (!bMatches[k]) k++
      if (a[i] !== b[k]) transpositions++
      k++
    }

    const sim = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3
    let prefix = 0
    for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
      if (a[i] === b[i]) prefix++
      else break
    }
    return sim + prefix * 0.1 * (1 - sim)
  }

  /**
   * Normalizes phone to standard E.164 (+1XXXXXXXXXX).
   */
  public static normalizePhone(phone?: string): string | null {
    if (!phone) return null
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 10) return `+1${digits}`
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
    if (digits.length > 7) return `+${digits}`
    return null
  }

  /**
   * Normalizes website into a clean domain.
   */
  public static extractDomain(url?: string): string | null {
    if (!url) return null
    return (
      url
        .toLowerCase()
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .split('/')[0]
        .split('?')[0] || null
    )
  }

  /**
   * Merges incoming raw leads into deduplicated unified records.
   */
  public static merge(existing: UnifiedLeadRecord[], incoming: RawDiscoveredLead): UnifiedLeadRecord[] {
    const incomingPhone = this.normalizePhone(incoming.phone)
    const incomingDomain = this.extractDomain(incoming.website)

    // Look for duplicate candidate
    const matchIndex = existing.findIndex((item) => {
      // 1. Exact phone match
      if (incomingPhone && item.normalizedPhone && incomingPhone === item.normalizedPhone) {
        return true
      }
      // 2. Exact domain match
      if (incomingDomain && item.domain && incomingDomain === item.domain) {
        return true
      }
      // 3. High fuzzy name similarity (> 0.88)
      const similarity = this.jaroWinkler(incoming.businessName, item.primaryName)
      return similarity >= 0.88
    })

    if (matchIndex >= 0) {
      // Merge into existing record
      const target = existing[matchIndex]
      target.sources = Array.from(new Set([...target.sources, incoming.source]))
      target.provenance[incoming.source] = incoming

      // Fill missing fields
      if (!target.normalizedPhone && incomingPhone) target.normalizedPhone = incomingPhone
      if (!target.domain && incomingDomain) target.domain = incomingDomain
      if (!target.address && incoming.address) target.address = incoming.address

      target.data = {
        ...target.data,
        ...incoming.extra,
        ...(incoming.rating ? { rating: incoming.rating } : {}),
        ...(incoming.reviews ? { reviews: incoming.reviews } : {}),
        ...(incoming.licenseNumber ? { licenseNumber: incoming.licenseNumber } : {}),
      }
      return existing
    }

    // Create new unified entity
    const newRecord: UnifiedLeadRecord = {
      primaryName: incoming.businessName,
      normalizedPhone: incomingPhone,
      domain: incomingDomain,
      address: incoming.address || null,
      sources: [incoming.source],
      provenance: { [incoming.source]: incoming },
      data: {
        businessName: incoming.businessName,
        phone: incomingPhone,
        website: incoming.website,
        domain: incomingDomain,
        address: incoming.address,
        city: incoming.city,
        state: incoming.state,
        rating: incoming.rating,
        reviews: incoming.reviews,
        licenseNumber: incoming.licenseNumber,
        ...incoming.extra,
      },
    }

    existing.push(newRecord)
    return existing
  }
}
