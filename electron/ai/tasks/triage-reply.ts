import type { AppSettings } from '../../../src/types'
import { getAiClient } from '../ai-client'

export interface ReplyTriageResult {
  intent: 'interested' | 'not_interested' | 'objection' | 'out_of_office' | 'bounce' | 'other'
  summary: string
  suggested_reply?: string
}

const SYSTEM_PROMPT = `
You are an expert sales assistant analyzing an incoming email reply to a cold outreach campaign.
Analyze the email text and classify the prospect's intent into one of the following categories:
- interested: The prospect is open to a meeting, asking for more information, or generally positive.
- not_interested: The prospect explicitly says no, to stop emailing, or they are not a fit.
- objection: The prospect is bringing up a specific objection (e.g. timing, budget, competitor) but isn't a hard "no".
- out_of_office: The email is an automated out-of-office response.
- bounce: The email is a delivery failure notification.
- other: Anything else that doesn't fit the above.

Also, provide a short 1-sentence summary of what the prospect said.

Return ONLY a valid JSON object matching this schema:
{
  "intent": "interested|not_interested|objection|out_of_office|bounce|other",
  "summary": "Short 1-sentence summary of their reply.",
  "suggested_reply": "If intent is 'objection', provide a polite 1-2 sentence response overcoming the objection to try to book a call. Otherwise null."
}
`

export async function triageReply(settings: AppSettings, model: string, emailBody: string): Promise<ReplyTriageResult> {
  try {
    const client = getAiClient(settings)
    const response = await client.completeJson<ReplyTriageResult>({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT.trim() },
        { role: 'user', content: emailBody.trim() }
      ],
      temperature: 0.1
    })

    return {
      intent: response.intent || 'other',
      summary: response.summary || '',
      suggested_reply: response.suggested_reply || undefined
    }
  } catch (err) {
    console.error('[AI] Failed to triage reply:', err)
    return { intent: 'other', summary: 'Failed to parse AI response' }
  }
}
