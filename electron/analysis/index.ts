// electron/analysis/index.ts
// Runs all checks for a single lead in parallel, persists results, triggers AI scoring.

import { getDataSource } from '../../src/db'
import { logActivity } from '../../src/db/queries/activity.queries'
import { getSettings } from '../../src/db/queries/settings.queries'
import { runPageSpeed } from './pagespeed'
import { runLighthouse } from './lighthouse'
import { checkSsl, estimateBuildYear } from './ssl-checker'
import { detectTechStack } from './wappalyzer'
import { searchLinkedInForOwner } from '../scraper/linkedin-dork'
import { scoreSite } from '../ai/tasks/score-site'
import { findEmailForLead } from '../email-finder'
import { crawlWebsiteForDecisionMakers } from '../scraper/extractors/website-crawler'
import { extractDecisionMaker } from '../ai/tasks/extract-decision-maker'
import { calculatePriority } from './priority-calculator'
import { LeadEntity } from '../../src/db/entities/LeadEntity'
import type { AnalysisResult } from '../../src/types/analysis.types'

export async function analyzeLead(leadId: number): Promise<AnalysisResult> {
  const leadRepo = getDataSource().getRepository(LeadEntity)
  const lead = await leadRepo.findOneBy({ id: leadId })
  if (!lead) throw new Error(`Lead ${leadId} not found`)

  const settings = await getSettings()
  const websiteUrl = lead.website_url

  // If no website and no AI enabled, we still want to run LinkedIn Dorking
  // so we do not short circuit here anymore.

  let seoPromise: Promise<any> = Promise.resolve(null)
  if (websiteUrl) {
    if (settings.seo_audit_engine === 'pagespeed') {
      seoPromise = runPageSpeed(websiteUrl, settings.pagespeed_api_key)
    } else if (settings.seo_audit_engine === 'lighthouse') {
      seoPromise = runLighthouse(websiteUrl).catch(() => null)
    }
  }

  // Run all checks in parallel (including LinkedIn Dork and Email Finder)
  const [pagespeedResult, sslResult, wappalyzerResult, dorkResult, , crawlerResult] = await Promise.allSettled([
    seoPromise,
    websiteUrl ? checkSsl(websiteUrl) : Promise.resolve(null),
    websiteUrl ? detectTechStack(websiteUrl) : Promise.resolve(null),
    searchLinkedInForOwner(lead.business_name, lead.city),
    findEmailForLead(leadId),
    websiteUrl && settings.ai_enabled ? crawlWebsiteForDecisionMakers(websiteUrl) : Promise.resolve(null)
  ])

  const pagespeed = pagespeedResult.status === 'fulfilled' ? pagespeedResult.value : null
  const ssl = sslResult.status === 'fulfilled' ? sslResult.value : null
  const wappalyzer = wappalyzerResult.status === 'fulfilled' ? wappalyzerResult.value : null
  const dork = dorkResult.status === 'fulfilled' ? dorkResult.value : null
  const crawlerData = crawlerResult.status === 'fulfilled' ? crawlerResult.value : null

  let aiDecisionMaker: import('../ai/tasks/extract-decision-maker').DecisionMakerInfo | null = null;
  if (crawlerData && settings.ai_enabled ) {
    aiDecisionMaker = await extractDecisionMaker(settings, settings.ai_model_site_scoring, crawlerData)
  }
  
  // Estimate build year from SSL last-modified header
  const builtYear = ssl ? estimateBuildYear(ssl.last_modified) : null

  // Serialize tech stack for storage
  const techStackJson = wappalyzer
    ? JSON.stringify(wappalyzer.technologies.map((t) => t.name))
    : null
    
  // Handle social links: Merge dork linkedin with any social links found on the website
  let socialLinksObj: Record<string, string> = {}
  if (ssl?.social_links) {
    socialLinksObj = { ...ssl.social_links }
  }
  if (dork?.linkedin_url) {
    socialLinksObj.linkedin = dork.linkedin_url
  }
  const socialLinksJson = Object.keys(socialLinksObj).length > 0 ? JSON.stringify(socialLinksObj) : null

  // Prioritize AI deep crawl decision maker over LinkedIn dorking if available
  const finalContactName = aiDecisionMaker?.contact_name || dork?.contact_name || lead.contact_name
  const finalEmail = aiDecisionMaker?.direct_email || lead.email

  // Persist all analysis data to DB
  await leadRepo.update(leadId, {
    pagespeed_mobile: pagespeed?.mobile_score ?? null,
    pagespeed_desktop: pagespeed?.desktop_score ?? null,
    ssl_valid: ssl ? ssl.ssl_valid : null,
    tech_stack: techStackJson,
    seo_metrics: pagespeed?.seo_metrics ?? null,
    site_built_year: builtYear,
    contact_name: finalContactName,
    email: finalEmail,
    social_links: socialLinksJson ?? lead.social_links,
    updated_at: new Date().toISOString()
  })

  // Run AI scoring now that we have all the data
  if (settings.ai_enabled ) {
    try {
      await scoreSite(settings, leadId, settings.ai_model_site_scoring, ssl)
    } catch {
      // AI failure shouldn't block analysis — lead still has pagespeed/ssl data
    }
  }

  // Auto-advance status: scraped → qualified if we have enough data
  const currentLead = await leadRepo.findOneBy({ id: leadId })
  if (currentLead?.status === 'scraped') {
    await leadRepo.update(leadId, {
      status: 'qualified',
      updated_at: new Date().toISOString()
    })
  }

  // Re-fetch the lead with all freshly-analyzed data
  const freshLead = await leadRepo.findOneBy({ id: leadId })
  if (!freshLead) throw new Error('Lead not found after analysis')

  const priorityResult = calculatePriority({
    website_url:       freshLead.website_url,
    pagespeed_mobile:  freshLead.pagespeed_mobile,
    pagespeed_desktop: freshLead.pagespeed_desktop,
    ssl_valid:         freshLead.ssl_valid,
    tech_stack:        freshLead.tech_stack,
    site_built_year:   freshLead.site_built_year,
    phone:             freshLead.phone,
    rating:            freshLead.review_rating,
    review_count:      freshLead.review_count,
  })

  await leadRepo.update(leadId, {
    priority_score: priorityResult.priority_score,
    priority_breakdown: JSON.stringify({ breakdown: priorityResult.breakdown, reasons: priorityResult.reasons }),
    updated_at: new Date().toISOString()
  })

  await logActivity(
    leadId,
    'lead_analyzed',
    `Priority: ${priorityResult.priority_score}/100 — ${priorityResult.reasons[0] ?? 'Standard lead'}`
  )

  return {
    lead_id: leadId,
    pagespeed: pagespeed ?? null,
    wappalyzer: wappalyzer ?? null,
    ssl: ssl ?? null,
    error: null
  }
}

// Batch analyze — processes leads sequentially to avoid hammering PageSpeed API
export async function analyzeBatch(
  leadIds: number[],
  onProgress: (done: number, total: number, leadId: number) => void
): Promise<void> {
  for (let i = 0; i < leadIds.length; i++) {
    try {
      await analyzeLead(leadIds[i])
    } catch {
      // Log and continue — never abort the batch
    }
    onProgress(i + 1, leadIds.length, leadIds[i])
    // Respect PageSpeed API rate limits — 1 req/sec safe limit without key
    await new Promise((r) => setTimeout(r, 1200))
  }
}
