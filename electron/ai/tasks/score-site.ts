// electron/ai/tasks/score-site.ts
import { getAiClient } from '../openrouter-client'
import { SITE_SCORER_SYSTEM, buildSiteScorerPrompt } from '../prompts/site-scorer'
import { DEFAULT_MODELS } from '../models'
import { getDb } from '../../../src/db'
import type { SiteScoreResult } from '../../../src/types/ai.types'

export async function scoreSite(
  apiKey: string,
  leadId: number,
  modelOverride?: string
): Promise<SiteScoreResult> {
  // Fetch lead data
  const lead = getDb().prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any
  if (!lead) throw new Error(`Lead ${leadId} not found`)

  const client = getAiClient(apiKey)
  const model = modelOverride ?? DEFAULT_MODELS.site_scoring

  const result = await client.completeJson<Omit<SiteScoreResult, 'model_used'>>({
    model,
    messages: [
      { role: 'system', content: SITE_SCORER_SYSTEM },
      { role: 'user', content: buildSiteScorerPrompt({
        business_name: lead.business_name,
        website_url: lead.website_url,
        pagespeed_mobile: lead.pagespeed_mobile,
        pagespeed_desktop: lead.pagespeed_desktop,
        ssl_valid: lead.ssl_valid,
        tech_stack: lead.tech_stack,
        site_built_year: lead.site_built_year,
      })},
    ],
    max_tokens: 512,
    temperature: 0.2,
  })

  // Validate score range
  const score = Math.min(100, Math.max(0, result.score ?? 0))

  // Persist result to DB
  getDb().prepare(`
    UPDATE leads SET
      ai_site_score = ?,
      ai_site_summary = ?,
      website_status = CASE
        WHEN ? = 0 THEN 'none'
        WHEN ? < 40 THEN 'outdated'
        WHEN ? < 70 THEN 'outdated'
        ELSE 'modern'
      END,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(score, result.summary, score, score, score, leadId)

  return {
    ...result,
    score,
    model_used: model,
  }
}
