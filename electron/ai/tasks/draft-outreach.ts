// electron/ai/tasks/draft-outreach.ts
import { getAiClient } from '../openrouter-client'
import { EMAIL_DRAFTER_SYSTEM, buildEmailDrafterPrompt } from '../prompts/email-drafter'
import { DEFAULT_MODELS } from '../models'
import { getDataSource } from '../../../src/db'
import type { OutreachDraft } from '../../../src/types/ai.types'

export async function draftOutreach(
  apiKey: string,
  leadId: number,
  developerName: string,
  modelOverride?: string
): Promise<OutreachDraft> {
  const lead = await getDataSource().createQueryBuilder()
    .select('*')
    .from('leads', 'leads')
    .where('id = :id', { id: leadId })
    .getRawOne()
  if (!lead) throw new Error(`Lead ${leadId} not found`)

  const client = getAiClient(apiKey)
  const model = modelOverride ?? DEFAULT_MODELS.email_draft

  let seoIssues: string[] = []
  try {
    seoIssues = lead.seo_metrics ? JSON.parse(lead.seo_metrics) : []
  } catch {
    seoIssues = []
  }

  const maxRetries = 2
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await client.completeJson<Omit<OutreachDraft, 'model_used'>>({
        model,
        messages: [
          { role: 'system', content: EMAIL_DRAFTER_SYSTEM },
          {
            role: 'user',
            content: buildEmailDrafterPrompt({
              business_name: lead.business_name,
              category: lead.category,
              city: lead.city,
              website_url: lead.website_url,
              site_score: lead.ai_site_score,
              site_summary: lead.ai_site_summary,
              site_issues: seoIssues,
              opportunity: lead.ai_personalized_hook || null,
              developer_name: developerName,
              contact_name: lead.contact_name || null
            })
          }
        ],
        max_tokens: 768,
        temperature: 0.6 // slightly higher for creative writing
      })

      return { ...result, model_used: model }
    } catch (err) {
      console.warn(`[DraftOutreach] Attempt ${attempt} failed for lead ${leadId}:`, err)
      if (attempt === maxRetries) {
        throw new Error(`Failed to draft outreach after ${maxRetries} attempts: ${err}`)
      }
      // Wait 1 second before retrying
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  throw new Error("Unreachable code in draftOutreach")
}
