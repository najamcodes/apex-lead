// electron/analysis/index.ts
// Runs all checks for a single lead in parallel, persists results, triggers AI scoring.

import { getDb } from '../../src/db'
import { logActivity } from '../../src/db/queries/activity.queries'
import { getSettings } from '../../src/db/queries/settings.queries'
import { runPageSpeed } from './pagespeed'
import { checkSsl, estimateBuildYear } from './ssl-checker'
import { detectTechStack } from './wappalyzer'
import { scoreSite } from '../ai/tasks/score-site'
import type { AnalysisResult } from '../../src/types/analysis.types'

export async function analyzeLead(leadId: number): Promise<AnalysisResult> {
  const lead = getDb().prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any
  if (!lead) throw new Error(`Lead ${leadId} not found`)

  const settings = getSettings()
  const websiteUrl = lead.website_url

  // No website — short circuit, just run AI score and return
  if (!websiteUrl) {
    if (settings.ai_enabled && settings.openrouter_api_key) {
      await scoreSite(settings.openrouter_api_key, leadId, settings.ai_model_site_scoring)
    }
    return { lead_id: leadId, pagespeed: null, wappalyzer: null, ssl: null, error: null }
  }

  // Run all checks in parallel
  const [pagespeedResult, sslResult, wappalyzerResult] = await Promise.allSettled([
    runPageSpeed(websiteUrl, settings.pagespeed_api_key),
    checkSsl(websiteUrl),
    detectTechStack(websiteUrl)
  ])

  const pagespeed = pagespeedResult.status === 'fulfilled' ? pagespeedResult.value : null
  const ssl = sslResult.status === 'fulfilled' ? sslResult.value : null
  const wappalyzer = wappalyzerResult.status === 'fulfilled' ? wappalyzerResult.value : null

  // Estimate build year from SSL last-modified header
  const builtYear = ssl ? estimateBuildYear(ssl.last_modified) : null

  // Serialize tech stack for storage
  const techStackJson = wappalyzer
    ? JSON.stringify(wappalyzer.technologies.map((t) => t.name))
    : null

  // Persist all analysis data to DB
  getDb()
    .prepare(
      `
    UPDATE leads SET
      pagespeed_mobile  = ?,
      pagespeed_desktop = ?,
      ssl_valid         = ?,
      tech_stack        = ?,
      site_built_year   = ?,
      updated_at        = datetime('now')
    WHERE id = ?
  `
    )
    .run(
      pagespeed?.mobile_score ?? null,
      pagespeed?.desktop_score ?? null,
      ssl ? (ssl.ssl_valid ? 1 : 0) : null,
      techStackJson,
      builtYear,
      leadId
    )

  // Run AI scoring now that we have all the data
  if (settings.ai_enabled && settings.openrouter_api_key) {
    try {
      await scoreSite(settings.openrouter_api_key, leadId, settings.ai_model_site_scoring)
    } catch {
      // AI failure shouldn't block analysis — lead still has pagespeed/ssl data
    }
  }

  // Auto-advance status: scraped → qualified if we have enough data
  const currentLead = getDb().prepare('SELECT status FROM leads WHERE id = ?').get(leadId) as any
  if (currentLead?.status === 'scraped') {
    getDb()
      .prepare(
        `
      UPDATE leads SET status = 'qualified', updated_at = datetime('now') WHERE id = ?
    `
      )
      .run(leadId)
  }

  const aiScoreRecord = getDb()
    .prepare('SELECT ai_site_score FROM leads WHERE id = ?')
    .get(leadId) as any
  logActivity(
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
