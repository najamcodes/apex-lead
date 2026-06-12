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
import type { AnalysisResult } from '../../src/types/analysis.types'

export async function analyzeLead(leadId: number): Promise<AnalysisResult> {
  const leads = await getDataSource().query('SELECT * FROM leads WHERE id = ?', [leadId])
  const lead = leads[0]
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
  const [pagespeedResult, sslResult, wappalyzerResult, dorkResult] = await Promise.allSettled([
    seoPromise,
    websiteUrl ? checkSsl(websiteUrl) : Promise.resolve(null),
    websiteUrl ? detectTechStack(websiteUrl) : Promise.resolve(null),
    searchLinkedInForOwner(lead.business_name, lead.city),
    findEmailForLead(leadId)
  ])

  const pagespeed = pagespeedResult.status === 'fulfilled' ? pagespeedResult.value : null
  const ssl = sslResult.status === 'fulfilled' ? sslResult.value : null
  const wappalyzer = wappalyzerResult.status === 'fulfilled' ? wappalyzerResult.value : null
  const dork = dorkResult.status === 'fulfilled' ? dorkResult.value : null
  
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

  // Persist all analysis data to DB
  await getDataSource().query(
    `
    UPDATE leads SET
      pagespeed_mobile  = ?,
      pagespeed_desktop = ?,
      ssl_valid         = ?,
      tech_stack        = ?,
      seo_metrics       = ?,
      site_built_year   = ?,
      contact_name      = COALESCE(contact_name, ?),
      social_links      = COALESCE(social_links, ?),
      updated_at        = datetime('now')
    WHERE id = ?
  `,
    [
      pagespeed?.mobile_score ?? null,
      pagespeed?.desktop_score ?? null,
      ssl ? (ssl.ssl_valid ? 1 : 0) : null,
      techStackJson,
      pagespeed?.seo_metrics ?? null,
      builtYear,
      dork?.contact_name ?? null,
      socialLinksJson,
      leadId
    ]
  )

  // Run AI scoring now that we have all the data
  if (settings.ai_enabled && settings.openrouter_api_key) {
    try {
      await scoreSite(settings.openrouter_api_key, leadId, settings.ai_model_site_scoring, ssl)
    } catch {
      // AI failure shouldn't block analysis — lead still has pagespeed/ssl data
    }
  }

  // Auto-advance status: scraped → qualified if we have enough data
  const currentLeads = await getDataSource().query('SELECT status FROM leads WHERE id = ?', [leadId])
  const currentLead = currentLeads[0]
  if (currentLead?.status === 'scraped') {
    await getDataSource().query(
      `
      UPDATE leads SET status = 'qualified', updated_at = datetime('now') WHERE id = ?
    `,
      [leadId]
    )
  }

  const aiScoreRecords = await getDataSource().query('SELECT ai_site_score FROM leads WHERE id = ?', [leadId])
  const aiScoreRecord = aiScoreRecords[0]
  await logActivity(
    leadId,
    'lead_analyzed',
    `PageSpeed mobile: ${pagespeed?.mobile_score ?? '—'}, AI score: ${aiScoreRecord?.ai_site_score ?? '—'}`
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
