import {
  EntityResolutionMerger,
  RawDiscoveredLead,
  UnifiedLeadRecord,
} from './EntityResolutionMerger'

export interface FederationQuery {
  query: string
  location: string
  sources?: string[]
  limit?: number
}

export class ScraperFederationService {
  /**
   * Executes concurrent federated scrapers and resolves entities on-the-fly.
   */
  public async federate(
    query: FederationQuery,
    onLeadDiscovered?: (lead: UnifiedLeadRecord) => void
  ): Promise<UnifiedLeadRecord[]> {
    const { query: keyword, location, limit = 20 } = query
    let unifiedRecords: UnifiedLeadRecord[] = []

    // 1. Concurrently query sources
    const rawBatches = await Promise.all([
      this.scrapeGoogleMaps(keyword, location),
      this.scrapeYellowPages(keyword, location),
      this.scrapeYelp(keyword, location),
    ])

    // 2. Interleave and resolve records
    for (const batch of rawBatches) {
      for (const raw of batch) {
        const prevLength = unifiedRecords.length
        unifiedRecords = EntityResolutionMerger.merge(unifiedRecords, raw)

        // If a new unified lead was appended, trigger stream callback
        if (unifiedRecords.length > prevLength && onLeadDiscovered) {
          onLeadDiscovered(unifiedRecords[unifiedRecords.length - 1])
        }

        if (unifiedRecords.length >= limit) {
          break
        }
      }
      if (unifiedRecords.length >= limit) {
        break
      }
    }

    return unifiedRecords
  }

  private async scrapeGoogleMaps(keyword: string, location: string): Promise<RawDiscoveredLead[]> {
    return [
      {
        source: 'google_maps',
        businessName: `${location} Premier ${keyword} Co.`,
        phone: '(555) 234-5678',
        website: `https://${keyword.toLowerCase().replace(/\s+/g, '')}premier.com`,
        address: `100 Main St, ${location}`,
        rating: 4.9,
        reviews: 94,
        extra: { gmaps_place_id: 'ChIJ_sample_1' },
      },
      {
        source: 'google_maps',
        businessName: `Apex Elite ${keyword}`,
        phone: '(555) 876-5432',
        website: `https://apexelite-${keyword.toLowerCase().replace(/\s+/g, '')}.com`,
        address: `250 Industrial Blvd, ${location}`,
        rating: 4.8,
        reviews: 62,
        extra: { gmaps_place_id: 'ChIJ_sample_2' },
      },
    ]
  }

  private async scrapeYellowPages(keyword: string, location: string): Promise<RawDiscoveredLead[]> {
    return [
      {
        source: 'yellow_pages',
        // Intentional duplicate with slight name variation & same phone to test fuzzy merger
        businessName: `${location} Premier ${keyword} Company`,
        phone: '+15552345678',
        website: `http://${keyword.toLowerCase().replace(/\s+/g, '')}premier.com/contact`,
        address: `100 Main Street, Suite 200, ${location}`,
        extra: { years_in_business: 14 },
      },
    ]
  }

  private async scrapeYelp(keyword: string, location: string): Promise<RawDiscoveredLead[]> {
    return [
      {
        source: 'yelp',
        businessName: `Precision ${keyword} Pro Services`,
        phone: '(555) 999-1122',
        website: `https://precision${keyword.toLowerCase().replace(/\s+/g, '')}.net`,
        address: `78 Commerce Way, ${location}`,
        rating: 5.0,
        reviews: 38,
        extra: { price_range: '$$' },
      },
    ]
  }
}
