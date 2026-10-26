# Implementation Prompt: Multi-Provider Email Waterfall & Direct Dial Phone Enrichment

## Prompt Objective
Build an enterprise-grade multi-provider email waterfall enrichment and direct dial mobile resolution engine (`WaterfallEnrichmentService`), with SMTP handshake verification, catch-all pattern resolution, credit caching, and an automated DAG pipeline node (`WaterfallEnrichmentNode`) for the Katal MVC server.

---

## Context & Architectural Rationale
Apollo.io charges high credit costs for email and direct dial discovery, yet uses single-source heuristics that fail on niche domains or produce hard bounces on 15–30% of contacts.

To beat Apollo at scale, ApexLead implements a **Waterfall Cascade**:
1. **Cache Check First:** Lookup our localized `verified_identities_cache` (free; 0 provider cost).
2. **Cascading API Waterfall:** Query Provider A (Hunter/Prospeo). If no verified match found, immediately cascade to Provider B (Dropcontact). If still unverified, cascade to Provider C (Enricher fallback).
3. **Real-Time SMTP / MX Socket Probe:** Connect directly to the recipient's mail exchanger port 25, simulate an SMTP transaction (`HELO`, `MAIL FROM`, `RCPT TO`), and inspect server response codes (250 OK vs 550 User Not Found) without sending an actual email.
4. **Catch-All Email Resolution:** For catch-all servers, generate common corporate permutations (`{first}.{last}`, `{f}{last}`, `{first}`, `{first}_{last}`) and evaluate pattern confidence against cross-referenced public records.
5. **Direct Dial Mobile Lookup:** Cascade phone numbers through carrier line-type identification (Twilio Lookup / Numverify) to separate mobile cell lines from landlines/switchboards.

---

## Database Schema Additions

```sql
-- PostgreSQL DDL for Enrichment Cache & Provider Logs
CREATE TABLE IF NOT EXISTS enrichment_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    resolved_email VARCHAR(255),
    email_status VARCHAR(50) NOT NULL, -- 'verified', 'catch_all', 'undeliverable', 'unknown'
    resolved_phone VARCHAR(50),
    phone_type VARCHAR(30), -- 'mobile', 'landline', 'voip'
    confidence_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    provider_source VARCHAR(50) NOT NULL,
    mx_record VARCHAR(255),
    smtp_check_passed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
);

CREATE INDEX IF NOT EXISTS idx_enrichment_lookup 
ON enrichment_cache (domain, first_name, last_name);

CREATE INDEX IF NOT EXISTS idx_enrichment_expires 
ON enrichment_cache (expires_at);
```

---

## File Changes & Additions

```
server/
├── src/
│   ├── services/
│   │   ├── enrichment/
│   │   │   ├── WaterfallEnrichmentService.ts
│   │   │   ├── SmtpVerifier.ts
│   │   │   ├── providers/
│   │   │   │   ├── IEnrichmentProvider.ts
│   │   │   │   ├── HunterProvider.ts
│   │   │   │   ├── ProspeoProvider.ts
│   │   │   │   └── DropcontactProvider.ts
│   │   │   └── DirectDialEnricher.ts
│   │   └── QuotaService.ts
│   ├── controllers/
│   │   └── EnrichmentController.ts
│   └── nodes/
│       └── WaterfallEnrichmentNode.ts
```

---

## Detailed Implementation Code

### 1. Real-Time SMTP Handshake Probe (`server/src/services/enrichment/SmtpVerifier.ts`)

```typescript
import dns from 'node:dns/promises';
import net from 'node:net';

export interface SmtpVerifyResult {
  valid: boolean;
  isCatchAll: boolean;
  mxHost: string | null;
  smtpResponse: string;
}

export class SmtpVerifier {
  private static readonly TIMEOUT_MS = 6000;

  /**
   * Performs an asynchronous MX resolution and SMTP handshake without sending an email.
   */
  public static async verifyEmail(email: string): Promise<SmtpVerifyResult> {
    const domain = email.split('@')[1];
    if (!domain) {
      return { valid: false, isCatchAll: false, mxHost: null, smtpResponse: 'Invalid email syntax' };
    }

    let mxRecords: dns.MxRecord[];
    try {
      mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return { valid: false, isCatchAll: false, mxHost: null, smtpResponse: 'No MX records found' };
      }
      mxRecords.sort((a, b) => a.priority - b.priority);
    } catch (err: any) {
      return { valid: false, isCatchAll: false, mxHost: null, smtpResponse: `DNS MX lookup failed: ${err.message}` };
    }

    const primaryMx = mxRecords[0].exchange;

    return new Promise((resolve) => {
      const socket = net.createConnection(25, primaryMx);
      let step = 0;
      let isCatchAll = false;
      let lastResponse = '';
      let timer: NodeJS.Timeout;

      const finish = (valid: boolean, catchAll = false, response = '') => {
        clearTimeout(timer);
        socket.destroy();
        resolve({ valid, isCatchAll: catchAll, mxHost: primaryMx, smtpResponse: response || lastResponse });
      };

      timer = setTimeout(() => {
        finish(false, false, 'SMTP Socket timeout');
      }, this.TIMEOUT_MS);

      socket.setEncoding('ascii');

      socket.on('error', (err) => {
        finish(false, false, `Socket connection error: ${err.message}`);
      });

      socket.on('data', (data) => {
        lastResponse = data.trim();
        const code = parseInt(data.substring(0, 3), 10);

        if (code >= 400 && code < 600) {
          return finish(false, false, lastResponse);
        }

        if (step === 0 && code === 220) {
          step = 1;
          socket.write(`HELO verify.apexlead.ai\r\n`);
        } else if (step === 1 && code === 250) {
          step = 2;
          socket.write(`MAIL FROM:<probe@verify.apexlead.ai>\r\n`);
        } else if (step === 2 && code === 250) {
          step = 3;
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else if (step === 3) {
          if (code === 250) {
            // Target accepted. Now send test random address to check for catch-all
            step = 4;
            const randomCatchAll = `probe-nonexistent-${Date.now()}@${domain}`;
            socket.write(`RCPT TO:<${randomCatchAll}>\r\n`);
          } else {
            finish(false, false, lastResponse);
          }
        } else if (step === 4) {
          if (code === 250) {
            // Server accepted completely fictitious address -> It is a catch-all server
            finish(true, true, 'Catch-all detected; domain accepts all recipients');
          } else {
            // Legitimate address succeeded, fake address rejected -> 100% verified inbox
            finish(true, false, 'Recipient inbox verified OK');
          }
        }
      });
    });
  }
}
```

---

### 2. Waterfall Enrichment Orchestrator (`server/src/services/enrichment/WaterfallEnrichmentService.ts`)

```typescript
import { Service, Inject } from 'katal';
import { DataSource } from 'typeorm';
import { SmtpVerifier } from './SmtpVerifier';
import { QuotaService } from '../QuotaService';

export interface EnrichmentTarget {
  firstName: string;
  lastName: string;
  domain: string;
  companyName?: string;
}

export interface EnrichmentResult {
  email: string | null;
  emailStatus: 'verified' | 'catch_all' | 'undeliverable' | 'unknown';
  phone: string | null;
  phoneType: 'mobile' | 'landline' | 'voip' | null;
  confidence: number;
  source: string;
  cached: boolean;
}

@Service()
export class WaterfallEnrichmentService {
  constructor(
    @Inject('DataSource') private dataSource: DataSource,
    @Inject(QuotaService) private quotaService: QuotaService
  ) {}

  /**
   * Executes multi-provider waterfall with cache bypass prevention and credit deduction.
   */
  public async enrichContact(orgId: string, target: EnrichmentTarget): Promise<EnrichmentResult> {
    const { firstName, lastName, domain } = target;
    const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

    // Step 1: Check localized cache (0 cost)
    const cached = await this.dataSource.query(
      `SELECT * FROM enrichment_cache 
       WHERE domain = $1 AND LOWER(first_name) = LOWER($2) AND LOWER(last_name) = LOWER($3)
       AND expires_at > NOW()
       LIMIT 1`,
      [cleanDomain, firstName, lastName]
    );

    if (cached.length > 0) {
      const row = cached[0];
      return {
        email: row.resolved_email,
        emailStatus: row.email_status,
        phone: row.resolved_phone,
        phoneType: row.phone_type,
        confidence: Number(row.confidence_score),
        source: `cache (${row.provider_source})`,
        cached: true,
      };
    }

    // Step 2: Quota deduction pre-check
    await this.quotaService.assertQuotaAvailable(orgId, 'leads', 1);

    // Step 3: Waterfall Providers
    let resolvedEmail: string | null = null;
    let resolvedPhone: string | null = null;
    let emailStatus: 'verified' | 'catch_all' | 'undeliverable' | 'unknown' = 'unknown';
    let phoneType: 'mobile' | 'landline' | 'voip' | null = null;
    let confidence = 0;
    let successfulProvider = 'none';

    // Waterfall Stage 1: Hunter / Primary Provider
    const stage1 = await this.queryHunter(firstName, lastName, cleanDomain);
    if (stage1 && stage1.email) {
      resolvedEmail = stage1.email;
      confidence = stage1.score;
      successfulProvider = 'hunter';
    }

    // Waterfall Stage 2: Prospeo if Stage 1 missed
    if (!resolvedEmail) {
      const stage2 = await this.queryProspeo(firstName, lastName, cleanDomain);
      if (stage2 && stage2.email) {
        resolvedEmail = stage2.email;
        confidence = stage2.score;
        successfulProvider = 'prospeo';
      }
    }

    // Waterfall Stage 3: Dropcontact if Stage 2 missed
    if (!resolvedEmail) {
      const stage3 = await this.queryDropcontact(firstName, lastName, cleanDomain);
      if (stage3 && stage3.email) {
        resolvedEmail = stage3.email;
        confidence = stage3.score;
        successfulProvider = 'dropcontact';
      }
    }

    // Step 4: Real-time SMTP Handshake Verification if email exists
    if (resolvedEmail) {
      const smtp = await SmtpVerifier.verifyEmail(resolvedEmail);
      if (smtp.valid && !smtp.isCatchAll) {
        emailStatus = 'verified';
        confidence = Math.max(confidence, 98);
      } else if (smtp.isCatchAll) {
        emailStatus = 'catch_all';
        confidence = Math.min(confidence, 70);
      } else {
        emailStatus = 'undeliverable';
        confidence = 10;
      }
    }

    // Step 5: Save to Enrichment Cache
    await this.dataSource.query(
      `INSERT INTO enrichment_cache 
       (domain, first_name, last_name, resolved_email, email_status, resolved_phone, phone_type, confidence_score, provider_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        cleanDomain,
        firstName,
        lastName,
        resolvedEmail,
        emailStatus,
        resolvedPhone,
        phoneType,
        confidence,
        successfulProvider,
      ]
    );

    // Step 6: Deduct quota if successfully resolved
    if (resolvedEmail && emailStatus !== 'undeliverable') {
      await this.quotaService.incrementUsage(orgId, 'leads', 1);
    }

    return {
      email: resolvedEmail,
      emailStatus,
      phone: resolvedPhone,
      phoneType,
      confidence,
      source: successfulProvider,
      cached: false,
    };
  }

  private async queryHunter(first: string, last: string, domain: string) {
    const apiKey = process.env.HUNTER_API_KEY;
    if (!apiKey) return null;
    try {
      const res = await fetch(`https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${first}&last_name=${last}&api_key=${apiKey}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data ? { email: json.data.email, score: json.data.score } : null;
    } catch {
      return null;
    }
  }

  private async queryProspeo(first: string, last: string, domain: string) {
    const apiKey = process.env.PROSPEO_API_KEY;
    if (!apiKey) return null;
    try {
      const res = await fetch('https://api.prospeo.io/email-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-KEY': apiKey },
        body: JSON.stringify({ first_name: first, last_name: last, company: domain }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.response ? { email: json.response.email, score: 90 } : null;
    } catch {
      return null;
    }
  }

  private async queryDropcontact(first: string, last: string, domain: string) {
    const apiKey = process.env.DROPCONTACT_API_KEY;
    if (!apiKey) return null;
    try {
      const res = await fetch('https://api.dropcontact.io/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Access-Token': apiKey },
        body: JSON.stringify({ data: [{ first_name: first, last_name: last, website: domain }] }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      const match = json.data?.[0];
      return match?.email ? { email: match.email[0]?.email, score: 85 } : null;
    } catch {
      return null;
    }
  }
}
```

---

### 3. Katal DAG Pipeline Node (`server/src/nodes/WaterfallEnrichmentNode.ts`)

```typescript
import { BaseNode, NodeContext } from './BaseNode';
import { WaterfallEnrichmentService } from '../services/enrichment/WaterfallEnrichmentService';
import { Container } from 'katal';

export class WaterfallEnrichmentNode extends BaseNode {
  public static readonly type = 'enrichment.waterfall';

  public async execute(context: NodeContext): Promise<void> {
    const enrichmentService = Container.get(WaterfallEnrichmentService);
    const { orgId, records } = context;

    for (const record of records) {
      const data = record.data || {};
      const firstName = data.firstName || data.contact_name?.split(' ')[0];
      const lastName = data.lastName || data.contact_name?.split(' ').slice(1).join(' ');
      const domain = data.website || data.domain;

      if (domain && firstName) {
        const enriched = await enrichmentService.enrichContact(orgId, {
          firstName,
          lastName: lastName || '',
          domain,
        });

        if (enriched.email) {
          record.data.email = enriched.email;
          record.data.email_verification_status = enriched.emailStatus;
          record.data.email_confidence = enriched.confidence;
          record.data.enrichment_source = enriched.source;
        }
      }
    }
  }
}
```

---

## Verification & Acceptance Criteria
1. **Socket Handshake Test:** Run integration test against a known corporate domain (`google.com`, `microsoft.com`) to confirm SMTP connection without sending email.
2. **Catch-All Detection:** Verify random UUID recipient addresses on catch-all domains return `isCatchAll: true`.
3. **Waterfall Fallback:** Mock failure on Provider A to confirm execution cascades seamlessly to Provider B and C without unhandled rejections.
4. **Cache Retention:** Verify that repeated enrichments for identical `{first, last, domain}` return in < 5ms with `cached: true` and zero third-party API spend.
