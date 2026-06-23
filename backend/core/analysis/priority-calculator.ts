// electron/analysis/priority-calculator.ts
// Computes the conversion-likelihood priority score for a lead.
// Runs immediately after AI site scoring, using all available analysis data.

export interface PriorityInputs {
  website_url:       string | null
  pagespeed_mobile:  number | null
  pagespeed_desktop: number | null
  ssl_valid:         boolean | null
  tech_stack:        string | null   // JSON array of detected tech names
  site_built_year:   number | null
  phone:             string | null
  rating:            number | null
  review_count:      number | null
}

export interface PriorityResult {
  priority_score: number
  breakdown: {
    no_website_score:      number
    pagespeed_score:        number
    ssl_score:               number
    tech_age_score:          number
    business_signal_score:   number
  }
  reasons: string[]   // human-readable explanations for the Review UI
}

// ─── Legacy tech signatures — older tech = higher priority ───────────────────

const LEGACY_TECH_SIGNALS: { pattern: RegExp; score: number; label: string }[] = [
  { pattern: /joomla/i,           score: 90, label: 'Joomla (legacy CMS)' },
  { pattern: /drupal\s*[1-6]/i,   score: 90, label: 'Old Drupal version' },
  { pattern: /wordpress/i,        score: 50, label: 'WordPress (check theme age)' },
  { pattern: /dreamweaver/i,      score: 95, label: 'Dreamweaver-built site' },
  { pattern: /frontpage/i,        score: 100, label: 'FrontPage (very old)' },
  { pattern: /flash/i,            score: 100, label: 'Flash content (deprecated)' },
  { pattern: /silverlight/i,      score: 100, label: 'Silverlight (deprecated)' },
  { pattern: /jquery\s*1\./i,     score: 70, label: 'jQuery 1.x (very old)' },
  { pattern: /mootools/i,         score: 80, label: 'MooTools (legacy framework)' },
  { pattern: /table.*layout/i,    score: 85, label: 'Table-based layout' },
  { pattern: /wix/i,               score: 20, label: 'Wix (modern, low priority)' },
  { pattern: /squarespace/i,       score: 15, label: 'Squarespace (modern, low priority)' },
  { pattern: /shopify/i,           score: 10, label: 'Shopify (modern e-commerce)' },
  { pattern: /webflow/i,           score: 10, label: 'Webflow (modern, low priority)' },
]

// ─── Component scorers ────────────────────────────────────────────────────────

function scoreNoWebsite(websiteUrl: string | null): { score: number; reason: string | null } {
  if (!websiteUrl) {
    return { score: 100, reason: 'No website at all — highest opportunity' }
  }
  return { score: 0, reason: null }
}

function scorePageSpeed(mobile: number | null, desktop: number | null): { score: number; reason: string | null } {
  if (mobile === null && desktop === null) return { score: 50, reason: null }

  // Use the worse of the two scores
  const worst = Math.min(mobile ?? 100, desktop ?? 100)

  // Invert: PageSpeed 0 → priority 100, PageSpeed 100 → priority 0
  const score = Math.round(100 - worst)

  let reason: string | null = null
  if (worst < 30) reason = `Very slow site (PageSpeed ${worst})`
  else if (worst < 50) reason = `Slow site (PageSpeed ${worst})`

  return { score, reason }
}

function scoreSsl(sslValid: boolean | null): { score: number; reason: string | null } {
  if (sslValid === null) return { score: 30, reason: null }  // unknown — mild priority
  if (sslValid === false) return { score: 100, reason: 'No SSL certificate — security risk for visitors' }
  return { score: 0, reason: null }
}

function scoreTechAge(techStackJson: string | null): { score: number; reason: string | null } {
  if (!techStackJson) return { score: 30, reason: null }  // unknown tech — mild priority

  let technologies: string[] = []
  try {
    technologies = JSON.parse(techStackJson)
  } catch {
    return { score: 30, reason: null }
  }

  if (technologies.length === 0) return { score: 40, reason: 'No detectable framework (possibly hand-coded/old)' }

  let maxScore = 20  // default for unrecognized modern stacks
  let matchedLabel: string | null = null

  for (const tech of technologies) {
    for (const signal of LEGACY_TECH_SIGNALS) {
      if (signal.pattern.test(tech)) {
        if (signal.score > maxScore) {
          maxScore = signal.score
          matchedLabel = signal.label
        }
      }
    }
  }

  return {
    score: maxScore,
    reason: matchedLabel ? `Tech stack: ${matchedLabel}` : null,
  }
}

function scoreBusinessSignal(
  phone: string | null,
  rating: number | null,
  reviewCount: number | null
): { score: number; reason: string | null } {
  let score = 0
  const reasons: string[] = []

  // Has phone = real, contactable business
  if (phone) {
    score += 40
  }

  // Has reviews = active, established business (worth pursuing)
  if (reviewCount !== null && reviewCount > 0) {
    if (reviewCount >= 10 && reviewCount <= 200) {
      score += 40  // sweet spot — established but not huge
      reasons.push(`${reviewCount} reviews — active local business`)
    } else if (reviewCount > 200) {
      score += 25  // very large — might already have marketing budget elsewhere
    } else {
      score += 20  // few reviews — newer business
    }
  }

  // Decent rating = legitimate business worth representing
  if (rating !== null && rating >= 3.5) {
    score += 20
  }

  return { score: Math.min(score, 100), reason: reasons[0] ?? null }
}

// ─── Main calculator ───────────────────────────────────────────────────────────

const WEIGHTS = {
  no_website:      0.35,
  pagespeed:        0.20,
  ssl:               0.15,
  tech_age:          0.15,
  business_signal:   0.15,
}

export function calculatePriority(inputs: PriorityInputs): PriorityResult {
  const noWebsite     = scoreNoWebsite(inputs.website_url)
  const pagespeed     = scorePageSpeed(inputs.pagespeed_mobile, inputs.pagespeed_desktop)
  const ssl           = scoreSsl(inputs.ssl_valid)
  const techAge       = scoreTechAge(inputs.tech_stack)
  const businessSignal = scoreBusinessSignal(inputs.phone, inputs.rating, inputs.review_count)

  // If no website, pagespeed/ssl/tech don't apply — redistribute their weight
  let finalScore: number
  if (!inputs.website_url) {
    // No website: weight is no_website (35%) + business_signal (15%) scaled up,
    // plus a baseline assumption that PageSpeed/SSL/tech would all be "bad" (100)
    finalScore = Math.round(
      noWebsite.score * WEIGHTS.no_website +
      100 * WEIGHTS.pagespeed +
      100 * WEIGHTS.ssl +
      50  * WEIGHTS.tech_age +   // neutral — no tech to judge
      businessSignal.score * WEIGHTS.business_signal
    )
  } else {
    finalScore = Math.round(
      noWebsite.score      * WEIGHTS.no_website +
      pagespeed.score      * WEIGHTS.pagespeed +
      ssl.score            * WEIGHTS.ssl +
      techAge.score        * WEIGHTS.tech_age +
      businessSignal.score * WEIGHTS.business_signal
    )
  }

  finalScore = Math.max(0, Math.min(100, finalScore))

  const reasons = [noWebsite.reason, pagespeed.reason, ssl.reason, techAge.reason, businessSignal.reason]
    .filter((r): r is string => r !== null)

  return {
    priority_score: finalScore,
    breakdown: {
      no_website_score:     noWebsite.score,
      pagespeed_score:       pagespeed.score,
      ssl_score:              ssl.score,
      tech_age_score:         techAge.score,
      business_signal_score:  businessSignal.score,
    },
    reasons,
  }
}
