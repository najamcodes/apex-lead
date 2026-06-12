// electron/ai/tasks/score-site.ts
import { getAiClient } from '../openrouter-client'
import { SITE_SCORER_SYSTEM, buildSiteScorerPrompt } from '../prompts/site-scorer'
import { DEFAULT_MODELS } from '../models'
import { getDataSource } from '../../../src/db'
import type { SiteScoreResult } from '../../../src/types/ai.types'
import type { SslResult } from '../../../src/types/analysis.types'

export async function scoreSite(
  apiKey: string,
  leadId: number,
  modelOverride?: string,
  sslResult?: SslResult | null
): Promise<SiteScoreResult> {
  // Fetch lead data
  const leads = await getDataSource().query('SELECT * FROM leads WHERE id = ?', [leadId])
  const lead = leads[0]
  if (!lead) throw new Error(`Lead ${leadId} not found`)

  const client = getAiClient(apiKey)
  const model = modelOverride ?? DEFAULT_MODELS.site_scoring

  const result = await client.completeJson<Omit<SiteScoreResult, 'model_used'>>({
    model,
    messages: [
      { role: 'system', content: SITE_SCORER_SYSTEM },
      {
        role: 'user',
        content: buildSiteScorerPrompt({
          business_name: lead.business_name,
          website_url: lead.website_url,
          pagespeed_mobile: lead.pagespeed_mobile,
          pagespeed_desktop: lead.pagespeed_desktop,
          ssl_valid: lead.ssl_valid,
          tech_stack: lead.tech_stack,
          site_built_year: lead.site_built_year,
          seo_metrics: lead.seo_metrics,
          site_content: sslResult?.site_content,
          contact_page_content: sslResult?.contact_page_content
        })
      }
    ],
    max_tokens: 512,
    temperature: 0.2
  })

  // Validate score range
  const score = Math.min(100, Math.max(0, result.score ?? 0))

  // Persist result to DB
  await getDataSource().query(
    `
    UPDATE leads SET
      ai_site_score = ?,
      ai_site_summary = ?,
      website_status = CASE
        WHEN ? = 0 THEN 'none'
        WHEN ? < 40 THEN 'outdated'
        WHEN ? < 70 THEN 'outdated'
        ELSE 'modern'
      END,
      ai_personalized_hook = ?,
      contact_name = COALESCE(contact_name, ?),
      updated_at = datetime('now')
    WHERE id = ?
  `,
    [
      score,
      result.summary,
      score,
      score,
      score,
      result.opportunity_hook ?? null,
      result.decision_maker_name ?? null,
      leadId
    ]
  )

  return {
    ...result,
    score,
    model_used: model
  }
}
