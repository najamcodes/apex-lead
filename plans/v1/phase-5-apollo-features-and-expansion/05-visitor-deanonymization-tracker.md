# Implementation Prompt: Website Visitor Deanonymization Tracker & High-Intent Slack Alerts

## Prompt Objective
Build an ultra-lightweight 1-line B2B website tracking snippet (`tracker.js`), a server-side reverse-IP corporate resolution engine, and automated Slack/Discord instant alert notifications when high-intent accounts visit high-value pages (e.g., `/pricing`, `/demo`) within the Katal MVC architecture.

---

## Context & Architectural Rationale
Apollo, Warmly, and Clearbit charge $300 to $1,000+/month for "Website Intent" tracking. 

ApexLead delivers this feature natively:
1. **Zero-Overhead Tracking Snippet:** A 3.2KB vanilla JavaScript snippet (`tracker.js`) with zero third-party dependencies, asynchronous beacon dispatch, and cookie-free device fingerprinting.
2. **Reverse-IP Corporate Resolution:** Maps incoming visitor IP addresses to company domains using autonomous ASN and commercial B2B IP ranges (filtering out consumer ISPs like Comcast, Verizon, AT&T).
3. **Intent Scoring & Action Triggers:** Tracks page navigation; when a company visits the pricing page or views case studies for > 90 seconds, intent score spikes.
4. **Automated Executive Discovery & Slack Webhook:** Automatically cascades into `WaterfallEnrichmentService` to discover top decision-makers (e.g., VP of Sales, Head of Procurement) and dispatches an actionable rich card to the user's Slack/Discord.

---

## Database Schema Additions

```sql
-- PostgreSQL DDL for Website Visitor Deanonymization
CREATE TABLE IF NOT EXISTS visitor_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    slack_webhook_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visitor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES visitor_sites(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    company_name VARCHAR(255),
    company_domain VARCHAR(255),
    company_industry VARCHAR(100),
    company_size VARCHAR(50),
    intent_score INT NOT NULL DEFAULT 10,
    pageview_count INT NOT NULL DEFAULT 1,
    visited_pricing BOOLEAN NOT NULL DEFAULT FALSE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visitor_pageviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
    path VARCHAR(500) NOT NULL,
    referrer VARCHAR(500),
    duration_seconds INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_site_intent 
ON visitor_sessions (site_id, intent_score DESC);
```

---

## File Changes & Additions

```
server/
├── public/
│   └── tracker.js
├── src/
│   ├── services/
│   │   ├── visitors/
│   │   │   ├── ReverseIpResolver.ts
│   │   │   ├── VisitorSessionService.ts
│   │   │   └── SlackAlertNotifier.ts
│   │   └── enrichment/
│   │       └── WaterfallEnrichmentService.ts
│   ├── controllers/
│   │   └── VisitorTrackerController.ts
│   └── jobs/
│       └── AutoEnrichHighIntentVisitorJob.ts
```

---

## Detailed Implementation Code

### 1. Ultra-Lightweight Client Script (`server/public/tracker.js`)

```javascript
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var siteKey = script.getAttribute('data-site');
  if (!siteKey) return;

  var API_ENDPOINT = script.getAttribute('data-endpoint') || 'https://api.apexlead.ai/api/v1/track';
  var sessionId = localStorage.getItem('_al_sid') || 'al_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  localStorage.setItem('_al_sid', sessionId);

  function trackPageview() {
    var payload = {
      siteKey: siteKey,
      sessionId: sessionId,
      path: window.location.pathname,
      referrer: document.referrer || null,
      screen: window.screen.width + 'x' + window.screen.height,
      timestamp: Date.now(),
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon(API_ENDPOINT, JSON.stringify(payload));
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_ENDPOINT, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(payload));
    }
  }

  // Track initial pageview
  trackPageview();

  // Listen for Single Page App (SPA) route changes
  var lastUrl = location.href;
  new MutationObserver(function () {
    var url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      trackPageview();
    }
  }).observe(document, { subtree: true, childList: true });
})();
```

---

### 2. Reverse-IP Resolution Service (`server/src/services/visitors/ReverseIpResolver.ts`)

```typescript
export interface CompanyIpProfile {
  isIsp: boolean;
  companyName: string | null;
  domain: string | null;
  industry: string | null;
  employeeCount: string | null;
  country: string | null;
}

export class ReverseIpResolver {
  private static readonly ISP_KEYWORDS = [
    'telecom', 'comcast', 'verizon', 'att', 'broadband', 
    'charter', 'spectrum', 'vodafone', 't-mobile', 'orange', 'residential'
  ];

  /**
   * Resolves an IP address to commercial corporate entity using MaxMind B2B or IPinfo.
   */
  public static async resolve(ip: string): Promise<CompanyIpProfile> {
    // Exclude localhost and private subnets
    if (ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return { isIsp: true, companyName: null, domain: null, industry: null, employeeCount: null, country: null };
    }

    try {
      const apiKey = process.env.IPINFO_TOKEN;
      if (!apiKey) {
        return { isIsp: true, companyName: null, domain: null, industry: null, employeeCount: null, country: null };
      }

      const res = await fetch(`https://ipinfo.io/${ip}?token=${apiKey}`);
      if (!res.ok) {
        return { isIsp: true, companyName: null, domain: null, industry: null, employeeCount: null, country: null };
      }

      const data = await res.json();
      const orgName = data.company?.name || data.org || '';
      const domain = data.company?.domain || null;

      // Detect and discard consumer ISPs
      const isConsumerIsp = this.ISP_KEYWORDS.some((kw) => orgName.toLowerCase().includes(kw));

      return {
        isIsp: isConsumerIsp || !domain,
        companyName: isConsumerIsp ? null : orgName,
        domain: isConsumerIsp ? null : domain,
        industry: data.company?.type || null,
        employeeCount: data.company?.employees || null,
        country: data.country || null,
      };
    } catch {
      return { isIsp: true, companyName: null, domain: null, industry: null, employeeCount: null, country: null };
    }
  }
}
```

---

### 3. Slack Webhook Notification Engine (`server/src/services/visitors/SlackAlertNotifier.ts`)

```typescript
import { Service } from 'katal';

export interface HighIntentAlertPayload {
  webhookUrl: string;
  companyName: string;
  companyDomain: string;
  intentScore: number;
  visitedPricing: boolean;
  path: string;
  recommendedLeads: { name: string; title: string; email: string }[];
}

@Service()
export class SlackAlertNotifier {
  public async sendAlert(payload: HighIntentAlertPayload): Promise<void> {
    const { webhookUrl, companyName, companyDomain, intentScore, visitedPricing, path, recommendedLeads } = payload;

    const leadsText = recommendedLeads.length > 0
      ? recommendedLeads.map((l) => `• *${l.name}* (${l.title}) — \`${l.email}\``).join('\n')
      : '_Click in ApexLead to enrich decision makers._';

    const body = {
      text: `🔥 High-Intent Account Detected: ${companyName}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🔥 High-Intent Visitor: ${companyName}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Domain:*\n<https://${companyDomain}|${companyDomain}>` },
            { type: 'mrkdwn', text: `*Intent Score:*\n⚡ ${intentScore} / 100` },
            { type: 'mrkdwn', text: `*Active Page:*\n\`${path}\`` },
            { type: 'mrkdwn', text: `*Pricing Viewed:*\n${visitedPricing ? '✅ Yes' : 'No'}` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Auto-Discovered Contacts:*\n${leadsText}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Enroll in Cadence', emoji: true },
              style: 'primary',
              url: `https://app.apexlead.ai/prospects?domain=${companyDomain}`,
            },
          ],
        },
      ],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
}
```

---

## Verification & Acceptance Criteria
1. **Beacon Delivery:** Embed `tracker.js` in a test page; verify `navigator.sendBeacon` hits `/api/v1/track` with status 204.
2. **ISP Exclusion Test:** Pass residential IP (e.g. Comcast); verify `ReverseIpResolver` marks `isIsp: true` and discards it from notifications.
3. **Intent Threshold Alert:** Trigger session with 3 pageviews including `/pricing`; verify intent score reaches > 50 and fires `SlackAlertNotifier`.
4. **Rich Slack Card Delivery:** Test with incoming webhook; verify Slack card renders domain link, intent score, and actionable cadence enrollment button.
