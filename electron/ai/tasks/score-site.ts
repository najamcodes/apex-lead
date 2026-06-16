import type { AppSettings } from '../../../src/types'
// electron/ai/tasks/score-site.ts
import { getAiClient } from '../ai-client'
import { SITE_SCORER_SYSTEM, buildSiteScorerPrompt } from '../prompts/site-scorer'
import { DEFAULT_MODELS } from '../models'
import { getDataSource } from '../../../src/db'
import type { SiteScoreResult } from '../../../src/types/ai.types'
import type { SslResult } from '../../../src/types/analysis.types'

export async function scoreSite(
  settings: AppSettings,
  leadId: number,
  modelOverride?: string,
  sslResult?: SslResult | null
): Promise<SiteScoreResult> {
  // Fetch lead data
  const lead = await getDataSource().createQueryBuilder()
    .select('*')
    .from('leads', 'leads')
    .where('id = :id', { id: leadId })
    .getRawOne()
  if (!lead) throw new Error(`Lead ${leadId} not found`)

  const client = getAiClient(settings)
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
  let website_status = 'modern'
  if (score === 0) website_status = 'none'
  else if (score < 70) website_status = 'outdated'

  await getDataSource().createQueryBuilder()
    .update('leads')
    .set({
      ai_site_score: score,
      ai_site_summary: result.summary,
      website_status,
      ai_personalized_hook: result.opportunity_hook ?? null,
      ai_icebreaker: result.icebreaker ?? null,
      ai_service_pitch: result.service_pitch ?? null,
      contact_name: result.decision_maker_name ?? lead.contact_name,
      updated_at: () => "datetime('now')"
    })
    .where('id = :id', { id: leadId })
    .execute()

  return {
    ...result,
    score,
    model_used: model
  }
}
