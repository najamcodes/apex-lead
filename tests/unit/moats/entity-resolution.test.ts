import { describe, it, expect } from 'bun:test'
import {
  EntityResolutionMerger,
  RawDiscoveredLead,
  UnifiedLeadRecord,
} from '../../../server/src/services/federation/EntityResolutionMerger'
import { ScraperFederationService } from '../../../server/src/services/federation/ScraperFederationService'

describe('EntityResolutionMerger & ScraperFederationService (Phase 6)', () => {
  it('should calculate accurate Jaro-Winkler string similarity', () => {
    expect(EntityResolutionMerger.jaroWinkler('Apex Roofing', 'Apex Roofing')).toBe(1.0)
    expect(EntityResolutionMerger.jaroWinkler('Apex Roofing LLC', 'Apex Roofing')).toBeGreaterThan(0.9)
    expect(EntityResolutionMerger.jaroWinkler('Apex Roofing', 'Zeta Plumbing')).toBeLessThan(0.7)
    expect(EntityResolutionMerger.jaroWinkler('Apex Roofing', 'Quantum Mechanics')).toBeLessThan(0.55)
  })

  it('should normalize phone numbers into clean E.164 format', () => {
    expect(EntityResolutionMerger.normalizePhone('(555) 234-5678')).toBe('+15552345678')
    expect(EntityResolutionMerger.normalizePhone('1-555-234-5678')).toBe('+15552345678')
    expect(EntityResolutionMerger.normalizePhone('+15552345678')).toBe('+15552345678')
    expect(EntityResolutionMerger.normalizePhone('')).toBeNull()
  })

  it('should extract and clean domain from arbitrary URLs', () => {
    expect(EntityResolutionMerger.extractDomain('https://www.apexroofingtx.com/about')).toBe(
      'apexroofingtx.com'
    )
    expect(EntityResolutionMerger.extractDomain('http://apexroofingtx.com?utm_source=gmaps')).toBe(
      'apexroofingtx.com'
    )
  })

  it('should merge multi-source duplicate leads into a single unified record', () => {
    let unified: UnifiedLeadRecord[] = []

    const lead1: RawDiscoveredLead = {
      source: 'google_maps',
      businessName: 'Apex Precision Roofing',
      phone: '(555) 234-5678',
      website: 'https://apexroofing.com',
      address: '100 Main St',
      rating: 4.9,
      reviews: 84,
    }

    const lead2: RawDiscoveredLead = {
      source: 'yellow_pages',
      businessName: 'Apex Precision Roofing LLC', // slight variation
      phone: '+15552345678', // matching phone
      website: 'http://apexroofing.com/contact',
      address: '100 Main St, Suite 200',
      extra: { licenseNumber: 'TX-ROOF-9921' },
    }

    unified = EntityResolutionMerger.merge(unified, lead1)
    expect(unified.length).toBe(1)
    expect(unified[0].sources).toEqual(['google_maps'])

    unified = EntityResolutionMerger.merge(unified, lead2)
    // MUST NOT create a duplicate lead
    expect(unified.length).toBe(1)
    expect(unified[0].sources).toContain('google_maps')
    expect(unified[0].sources).toContain('yellow_pages')
    expect(unified[0].data.licenseNumber).toBe('TX-ROOF-9921')
    expect(unified[0].data.rating).toBe(4.9)
  })

  it('should federate queries across multi-source providers and emit stream events', async () => {
    const federation = new ScraperFederationService()
    const streamedLeads: UnifiedLeadRecord[] = []

    const results = await federation.federate(
      { query: 'Roofing', location: 'Austin, TX', limit: 5 },
      (lead) => {
        streamedLeads.push(lead)
      }
    )

    expect(results.length).toBeGreaterThan(0)
    expect(streamedLeads.length).toBe(results.length)
  })
})
