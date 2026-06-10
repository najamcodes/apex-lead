// electron/ai/tasks/draft-outreach.ts
import { getAiClient } from '../openrouter-client'
import { EMAIL_DRAFTER_SYSTEM, buildEmailDrafterPrompt } from '../prompts/email-drafter'
import { DEFAULT_MODELS } from '../models'
import { getDb } from '../../../src/db'
import type { OutreachDraft } from '../../../src/types/ai.types'

export async function draftOutreach(
  apiKey: string,
  leadId: number,
  developerName: string,
  modelOverride?: string
): Promise<OutreachDraft> {
  const lead = getDb().prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any
  if (!lead) throw new Error(`Lead ${leadId} not found`)

  const client = getAiClient(apiKey)
  const model = modelOverride ?? DEFAULT_MODELS.email_draft

  // Parse stored issues from ai result (stored as JSON string or comma list)
  let issues: string[] = []
  try {
    issues = lead.tech_stack ? JSON.parse(lead.tech_stack) : []
  } catch {
    issues = []
  }

  const result = await client.completeJson<Omit<OutreachDraft, 'model_used'>>({
    model,
    messages: [
      { role: 'system', content: EMAIL_DRAFTER_SYSTEM },
      { role: 'user', content: buildEmailDrafterPrompt({
        business_name: lead.business_name,
        category: lead.category,
        city: lead.city,
        website_url: lead.website_url,
        site_score: lead.ai_site_score,
        site_summary: lead.ai_site_summary,
        site_issues: issues,
        opportunity: null,
        developer_name: developerName,
      })},
    ],
    max_tokens: 768,
    temperature: 0.6,  // slightly higher for creative writing
  })

  return { ...result, model_used: model }
}
