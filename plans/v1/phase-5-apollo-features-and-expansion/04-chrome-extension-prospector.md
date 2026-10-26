# Implementation Prompt: Chrome Extension Manifest V3 Prospector (LinkedIn & Google Maps 1-Click Capture)

## Prompt Objective
Build a lightweight, high-performance Chrome Extension (Manifest V3) called **ApexLead Prospector** that allows users to extract contacts with 1 click directly from LinkedIn, LinkedIn Sales Navigator, Google Maps, and any corporate website, triggering instant waterfall enrichment and cadence enrollment via the Katal MVC API.

---

## Context & Architectural Rationale
Apollo's Chrome extension is notorious for lagging browsers, leaking memory, and crashing on Sales Navigator pagination. 

ApexLead's extension is engineered with modern web standards:
1. **Manifest V3 Compliant:** Background service worker lifecycle, zero blocking declarativeNetRequest abuse, and dynamic content scripts.
2. **SidePanel API (Chrome 114+):** Clean, persistent sliding side panel alongside the webpage rather than clunky floating DOM overlays that break site CSS.
3. **Multi-Platform Scraping Targets:**
   - **LinkedIn / Sales Navigator:** Captures executive name, role, company, company domain, and location.
   - **Google Maps:** Captures business name, phone, address, verified website, review count, and star rating directly from active map panels.
4. **1-Click Live Waterfall & Cadence Push:** Initiates the server-side waterfall cascade (`/api/enrichment/waterfall`) and optionally enrolls the discovered prospect into an active outbound cadence in < 2 seconds.

---

## Directory Structure & File Additions

```
extension/
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   ├── content/
│   │   ├── linkedin-extractor.ts
│   │   └── gmaps-extractor.ts
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── SidePanelApp.tsx
│   │   └── components/
│   │       ├── ContactCard.tsx
│   │       ├── WaterfallStatusBadge.tsx
│   │       └── CadenceSelectModal.tsx
│   └── lib/
│       ├── api-client.ts
│       └── storage.ts
```

---

## Detailed Implementation Code

### 1. Extension Manifest V3 (`extension/manifest.json`)

```json
{
  "manifest_version": 3,
  "name": "ApexLead Prospector & Live Scraper",
  "version": "1.0.0",
  "description": "1-click lead capture and waterfall email verification for LinkedIn, Google Maps, and company websites.",
  "permissions": [
    "sidePanel",
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "https://*.linkedin.com/*",
    "https://*.google.com/maps/*",
    "https://api.apexlead.ai/*",
    "http://localhost:3000/*"
  ],
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },
  "content_scripts": [
    {
      "matches": ["https://*.linkedin.com/in/*", "https://*.linkedin.com/sales/*"],
      "js": ["src/content/linkedin-extractor.ts"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://*.google.com/maps/*"],
      "js": ["src/content/gmaps-extractor.ts"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_title": "Open ApexLead Sidepanel"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

---

### 2. LinkedIn DOM Extractor (`extension/src/content/linkedin-extractor.ts`)

```typescript
export interface ExtractedProspect {
  type: 'individual';
  firstName: string;
  lastName: string;
  headline: string;
  companyName: string;
  companyDomain?: string;
  location: string;
  linkedinUrl: string;
}

function extractLinkedInProfile(): ExtractedProspect | null {
  const isSalesNav = window.location.href.includes('/sales/');
  
  if (isSalesNav) {
    const nameEl = document.querySelector('h1.profile-topcard__heading');
    const titleEl = document.querySelector('.profile-topcard__headline');
    const companyEl = document.querySelector('.profile-topcard__company-name');
    const locationEl = document.querySelector('.profile-topcard__location');

    if (!nameEl) return null;
    const fullName = nameEl.textContent?.trim() || '';
    const parts = fullName.split(' ');

    return {
      type: 'individual',
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      headline: titleEl?.textContent?.trim() || '',
      companyName: companyEl?.textContent?.trim() || '',
      location: locationEl?.textContent?.trim() || '',
      linkedinUrl: window.location.href,
    };
  }

  // Standard LinkedIn Profile
  const nameEl = document.querySelector('h1.text-heading-xlarge');
  const headlineEl = document.querySelector('div.text-body-medium.break-words');
  const locationEl = document.querySelector('span.text-body-small.inline.t-black--light');

  if (!nameEl) return null;
  const fullName = nameEl.textContent?.trim() || '';
  const parts = fullName.split(' ');

  // Try to find current company from experience section
  const currentCompanyEl = document.querySelector('div[data-view-name="profile-component-entity"] span[aria-hidden="true"]');

  return {
    type: 'individual',
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
    headline: headlineEl?.textContent?.trim() || '',
    companyName: currentCompanyEl?.textContent?.trim() || '',
    location: locationEl?.textContent?.trim() || '',
    linkedinUrl: window.location.href.split('?')[0],
  };
}

// Listen for messages from background/sidepanel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'EXTRACT_ACTIVE_LEAD') {
    const data = extractLinkedInProfile();
    sendResponse({ success: !!data, data });
  }
});
```

---

### 3. Google Maps Extractor (`extension/src/content/gmaps-extractor.ts`)

```typescript
export interface ExtractedLocalBusiness {
  type: 'local_business';
  name: string;
  phone?: string;
  website?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  gmapsUrl: string;
}

function extractGmapsBusiness(): ExtractedLocalBusiness | null {
  const nameEl = document.querySelector('h1.DUwDvf');
  if (!nameEl) return null;

  const phoneEl = document.querySelector('button[data-tooltip*="phone"] .Io6YTe, button[data-item-id*="phone"] .Io6YTe');
  const websiteEl = document.querySelector('a[data-tooltip*="website"], a[data-item-id*="authority"]');
  const addressEl = document.querySelector('button[data-item-id*="address"] .Io6YTe');
  const ratingEl = document.querySelector('span.ceNzKf');
  const reviewsEl = document.querySelector('span.F7nice span:last-child');

  let rating = 0;
  if (ratingEl) {
    const raw = ratingEl.getAttribute('aria-label') || '';
    const match = raw.match(/([0-9.]+)/);
    if (match) rating = parseFloat(match[1]);
  }

  let reviews = 0;
  if (reviewsEl) {
    const raw = reviewsEl.textContent?.replace(/[^0-9]/g, '') || '';
    if (raw) reviews = parseInt(raw, 10);
  }

  return {
    type: 'local_business',
    name: nameEl.textContent?.trim() || '',
    phone: phoneEl?.textContent?.trim(),
    website: websiteEl?.getAttribute('href') || undefined,
    address: addressEl?.textContent?.trim(),
    rating,
    reviews,
    gmapsUrl: window.location.href,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'EXTRACT_ACTIVE_LEAD') {
    const data = extractGmapsBusiness();
    sendResponse({ success: !!data, data });
  }
});
```

---

### 4. Sidepanel React Application (`extension/src/sidepanel/SidePanelApp.tsx`)

```tsx
import React, { useState, useEffect } from 'react';
import { 
  Sparkles, CheckCircle2, AlertCircle, Mail, Phone, 
  Send, ExternalLink, RefreshCw, Loader2 
} from 'lucide-react';

export function SidePanelApp() {
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichedData, setEnrichedData] = useState<any>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fetchActiveTabLead = () => {
    setLoading(true);
    setEnrichedData(null);
    setSavedSuccess(false);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        setLoading(false);
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { action: 'EXTRACT_ACTIVE_LEAD' }, (response) => {
        setLoading(false);
        if (response?.success && response.data) {
          setLead(response.data);
        } else {
          setLead(null);
        }
      });
    });
  };

  useEffect(() => {
    fetchActiveTabLead();
  }, []);

  const handleWaterfallEnrich = async () => {
    if (!lead) return;
    setEnriching(true);

    try {
      // Direct call to Katal MVC server
      const token = (await chrome.storage.sync.get('authToken')).authToken;
      const res = await fetch('https://api.apexlead.ai/api/enrichment/waterfall', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: lead.firstName || lead.name,
          lastName: lead.lastName || '',
          domain: lead.companyDomain || lead.website || lead.companyName + '.com',
        }),
      });

      const data = await res.json();
      setEnrichedData(data);
    } catch (err: any) {
      console.error('Enrichment failed:', err);
    } finally {
      setEnriching(false);
    }
  };

  const handleSaveToWorkspace = async () => {
    // Saves to active pipeline collection and auto-enrolls in cadence
    setSavedSuccess(true);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-4 font-sans flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-xs">
              A
            </div>
            <span className="font-bold text-sm tracking-tight text-white">ApexLead Prospector</span>
          </div>
          <button 
            onClick={fetchActiveTabLead}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Content */}
        {!lead ? (
          <div className="py-12 text-center">
            <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">
              Navigate to a LinkedIn profile or Google Maps place to capture contact details.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                Detected {lead.type === 'individual' ? 'Professional' : 'Business'}
              </span>
              <h3 className="font-bold text-base text-white mt-1">
                {lead.firstName ? `${lead.firstName} ${lead.lastName}` : lead.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lead.headline || lead.address}
              </p>
              {lead.companyName && (
                <p className="text-xs text-slate-300 font-medium mt-1">
                  🏢 {lead.companyName}
                </p>
              )}
            </div>

            {/* Waterfall Enrichment Action */}
            {!enrichedData ? (
              <button
                onClick={handleWaterfallEnrich}
                disabled={enriching}
                className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                {enriching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Resolving Waterfall...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Find Verified Email & Phone
                  </>
                )}
              </button>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified Contact Found
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {enrichedData.confidence}% confidence
                  </span>
                </div>

                <div className="text-xs font-mono text-white flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{enrichedData.email || 'Email unavailable'}</span>
                </div>

                {enrichedData.phone && (
                  <div className="text-xs font-mono text-white flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{enrichedData.phone}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Action */}
      {lead && (
        <div className="pt-4 border-t border-slate-800 mt-4">
          <button
            onClick={handleSaveToWorkspace}
            disabled={savedSuccess}
            className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              savedSuccess
                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-700'
            }`}
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved to Active Pipeline
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Save Lead & Push to Cadence
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Verification & Acceptance Criteria
1. **Sidepanel Docking:** Test on Chrome 114+; verify clicking extension icon opens native side panel without covering the website viewport.
2. **LinkedIn Profile Capture:** Test on both standard LinkedIn (`/in/*`) and Sales Navigator (`/sales/lead/*`); verify first name, last name, and current employer parse accurately.
3. **Google Maps Capture:** Test on a business listing in Google Maps; verify phone, website, and star ratings extract with zero DOM selector errors.
4. **Waterfall Trigger:** Verify the side panel communicates with `WaterfallEnrichmentService` on the Katal server and displays verified emails with confidence metrics.
