# Implementation Prompt: Real-Time Scraper Federation Engine & Fuzzy Entity Resolution

## Prompt Objective
Build an on-demand multi-source scraper federation engine (`ScraperFederationService`) that queries Google Maps, YellowPages, Yelp, Houzz, and State Licensing Registries concurrently, performing fuzzy entity deduplication (Jaro-Winkler + phone E.164 normalization) and streaming live discovered records to the frontend via Server-Sent Events (SSE).

---

## Context & Architectural Rationale
Apollo and ZoomInfo can only show you what already exists in their static database. If a new business opens today, or if a contractor updates their phone number on Google Maps, Apollo misses it.

ApexLead's **Live Federation Engine** changes the paradigm:
1. **Concurrent Multi-Source Fan-Out:** When a user queries *"HVAC Contractors in Orlando, FL"*, the engine queries:
   - Google Maps (for ratings, coordinates, reviews, active status)
   - YellowPages / Yelp (for alternative numbers and operating hours)
   - State Contractor Licensing Board (for license number, bond status, and owner legal name)
2. **Fuzzy Entity Resolution & Provenance Tagging:** Merges partial records from multiple sources into a single comprehensive polymorphic entity without creating duplicates. Uses E.164 normalized phone matching, domain matching, and Jaro-Winkler name similarity (>0.88).
3. **Real-Time Stream Engine:** Rather than waiting minutes for a full batch to finish, results stream to the user's browser in milliseconds over Server-Sent Events (SSE).

---

## File Changes & Additions

```
server/
├── src/
│   ├── services/
│   │   ├── federation/
│   │   │   ├── ScraperFederationService.ts
│   │   │   ├── EntityResolutionMerger.ts
│   │   │   ├── providers/
│   │   │   │   ├── GoogleMapsScraperProvider.ts
│   │   │   │   ├── YellowPagesScraperProvider.ts
│   │   │   │   ├── YelpScraperProvider.ts
│   │   │   │   └── StateLicensingScraperProvider.ts
│   │   │   └── StreamEmitter.ts
│   ├── controllers/
│   │   └── FederationStreamController.ts
│   └── utils/
│       ├── PhoneNormalizer.ts
│       └── JaroWinkler.ts
```

---

## Detailed Implementation Code

### 1. Fuzzy Entity Resolution Merger (`server/src/services/federation/EntityResolutionMerger.ts`)

```typescript
export interface RawDiscoveredLead {
  source: string;
  businessName: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  rating?: number;
  reviews?: number;
  licenseNumber?: string;
  extra?: Record<string, any>;
}

export interface UnifiedLeadRecord {
  primaryName: string;
  normalizedPhone: string | null;
  domain: string | null;
  address: string | null;
  sources: string[];
  provenance: Record<string, any>;
  data: Record<string, any>;
}

export class EntityResolutionMerger {
  /**
   * Calculates Jaro-Winkler string distance (0.0 to 1.0).
   */
  public static jaroWinkler(s1: string, s2: string): number {
    const a = s1.toLowerCase().trim();
    const b = s2.toLowerCase().trim();
    if (a === b) return 1.0;
    if (!a.length || !b.length) return 0.0;

    const matchDistance = Math.floor(Math.max(a.length, b.length) / 2) - 1;
    const aMatches = new Array(a.length).fill(false);
    const bMatches = new Array(b.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    for (let i = 0; i < a.length; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, b.length);
      for (let j = start; j < end; j++) {
        if (bMatches[j] || a[i] !== b[j]) continue;
        aMatches[i] = true;
        bMatches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    let k = 0;
    for (let i = 0; i < a.length; i++) {
      if (!aMatches[i]) continue;
      while (!bMatches[k]) k++;
      if (a[i] !== b[k]) transpositions++;
      k++;
    }

    const sim = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
    let prefix = 0;
    for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
      if (a[i] === b[i]) prefix++;
      else break;
    }
    return sim + prefix * 0.1 * (1 - sim);
  }

  /**
   * Normalizes phone to standard E.164 (+1XXXXXXXXXX).
   */
  public static normalizePhone(phone?: string): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (digits.length > 7) return `+${digits}`;
    return null;
  }

  /**
   * Normalizes website into a clean domain.
   */
  public static extractDomain(url?: string): string | null {
    if (!url) return null;
    return url
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .split('/')[0]
      .split('?')[0] || null;
  }

  /**
   * Merges incoming raw leads into deduplicated unified records.
   */
  public static merge(existing: UnifiedLeadRecord[], incoming: RawDiscoveredLead): UnifiedLeadRecord[] {
    const incomingPhone = this.normalizePhone(incoming.phone);
    const incomingDomain = this.extractDomain(incoming.website);

    // Look for duplicate candidate
    const matchIndex = existing.findIndex((item) => {
      // 1. Exact phone match
      if (incomingPhone && item.normalizedPhone && incomingPhone === item.normalizedPhone) {
        return true;
      }
      // 2. Exact domain match
      if (incomingDomain && item.domain && incomingDomain === item.domain) {
        return true;
      }
      // 3. High fuzzy name similarity (> 0.88)
      const similarity = this.jaroWinkler(incoming.businessName, item.primaryName);
      return similarity >= 0.88;
    });

    if (matchIndex >= 0) {
      // Merge into existing record
      const target = existing[matchIndex];
      target.sources = Array.from(new Set([...target.sources, incoming.source]));
      target.provenance[incoming.source] = incoming;

      // Fill missing fields
      if (!target.normalizedPhone && incomingPhone) target.normalizedPhone = incomingPhone;
      if (!target.domain && incomingDomain) target.domain = incomingDomain;
      if (!target.address && incoming.address) target.address = incoming.address;

      target.data = {
        ...target.data,
        ...incoming.extra,
        ...(incoming.rating ? { rating: incoming.rating } : {}),
        ...(incoming.reviews ? { reviews: incoming.reviews } : {}),
        ...(incoming.licenseNumber ? { licenseNumber: incoming.licenseNumber } : {}),
      };
      return existing;
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
    };

    existing.push(newRecord);
    return existing;
  }
}
```

---

### 2. Scraper Federation Orchestrator (`server/src/services/federation/ScraperFederationService.ts`)

```typescript
import { Service, Inject } from 'katal';
import { EntityResolutionMerger, RawDiscoveredLead, UnifiedLeadRecord } from './EntityResolutionMerger';
import { GoogleMapsScraperProvider } from './providers/GoogleMapsScraperProvider';
import { YellowPagesScraperProvider } from './providers/YellowPagesScraperProvider';
import { YelpScraperProvider } from './providers/YelpScraperProvider';

export interface FederationQuery {
  query: string;
  location: string;
  sources?: string[];
  limit?: number;
}

@Service()
export class ScraperFederationService {
  constructor(
    @Inject(GoogleMapsScraperProvider) private gmaps: GoogleMapsScraperProvider,
    @Inject(YellowPagesScraperProvider) private yellowpages: YellowPagesScraperProvider,
    @Inject(YelpScraperProvider) private yelp: YelpScraperProvider
  ) {}

  /**
   * Executes concurrent federated scrapers and calls onLeadDiscovered stream callback.
   */
  public async federate(
    query: FederationQuery,
    onLeadDiscovered: (lead: UnifiedLeadRecord) => void
  ): Promise<UnifiedLeadRecord[]> {
    const records: UnifiedLeadRecord[] = [];
    const targetLimit = query.limit || 50;

    const streamCallback = (rawLead: RawDiscoveredLead) => {
      const prevLength = records.length;
      EntityResolutionMerger.merge(records, rawLead);

      // If a new unified lead was appended or updated, stream it
      const current = records[records.length - 1];
      if (current && records.length > prevLength) {
        onLeadDiscovered(current);
      }
    };

    // Execute scrapers concurrently with Promise.allSettled
    const tasks = [
      this.gmaps.scrapeStream(query.query, query.location, targetLimit, streamCallback),
      this.yellowpages.scrapeStream(query.query, query.location, targetLimit, streamCallback),
      this.yelp.scrapeStream(query.query, query.location, targetLimit, streamCallback),
    ];

    await Promise.allSettled(tasks);
    return records;
  }
}
```

---

### 3. Server-Sent Events (SSE) Stream Controller (`server/src/controllers/FederationStreamController.ts`)

```typescript
import { Controller, Get, Query, Res, Inject } from 'katal';
import type { Response } from 'express';
import { ScraperFederationService } from '../services/federation/ScraperFederationService';

@Controller('/api/v1/stream')
export class FederationStreamController {
  constructor(@Inject(ScraperFederationService) private federationService: ScraperFederationService) {}

  @Get('/federated-scrape')
  public async streamLiveScrape(
    @Query('q') query: string,
    @Query('location') location: string,
    @Res() res: Response
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial handshake
    res.write(`data: ${JSON.stringify({ status: 'connected', query, location })}\n\n`);

    try {
      await this.federationService.federate(
        { query, location, limit: 100 },
        (unifiedLead) => {
          res.write(`data: ${JSON.stringify({ type: 'lead', record: unifiedLead })}\n\n`);
        }
      );

      res.write(`data: ${JSON.stringify({ status: 'completed' })}\n\n`);
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ status: 'error', message: err.message })}\n\n`);
    } finally {
      res.end();
    }
  }
}
```

---

## Verification & Acceptance Criteria
1. **Jaro-Winkler Accuracy:** Unit test verifying `"Apex Roofing LLC"` and `"Apex Roofing, Inc."` match with score >= 0.90, while `"Apex Dental"` scores < 0.60.
2. **Phone Normalization:** Test US phone variations `(407) 555-1234`, `407-555-1234`, `+1 407 555 1234` all normalize to `+14075551234`.
3. **Multi-Source Deduplication:** Feed duplicate leads from Google Maps and YellowPages with identical phone numbers; verify only one unified record is produced with `sources = ['gmaps', 'yellowpages']`.
4. **SSE Stream Delivery:** Connect to `/api/v1/stream/federated-scrape?q=plumber&location=Dallas` via `EventSource`; verify chunks stream without connection timeouts.
