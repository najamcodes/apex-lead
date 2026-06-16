import type { AppSettings } from '../../../src/types'
import { getAiClient } from '../ai-client'
import type { CrawledWebsiteData } from '../../scraper/extractors/website-crawler'

export interface DecisionMakerInfo {
  contact_name: string | null
  direct_email: string | null
  role: string | null
}

const SYSTEM_PROMPT = `
You are an expert Lead Generation Analyst.
You will be provided with raw text scraped from a company's website (Homepage, About Us, Team, Contact pages), as well as a list of emails found on the site.
Your goal is to identify the name of the main decision maker (Founder, CEO, Owner, President, Managing Director, Partner).
If you find their specific name, try to identify their direct email from the list of emails found, or infer it based on standard business formats (e.g. if name is John Smith and email list has john@company.com, that is the direct email).

Return ONLY a valid JSON object matching this schema, with no markdown formatting or other text:
{
  "contact_name": "Full Name" | null,
  "role": "CEO/Founder/Owner/etc" | null,
  "direct_email": "email@company.com" | null
}

If you cannot confidently identify a specific person, return null for all fields. Do NOT return generic names like "Sales Team".
`

export async function extractDecisionMaker(
  settings: AppSettings,
  model: string,
  data: CrawledWebsiteData
): Promise<DecisionMakerInfo> {
  const prompt = `
Website URL: ${data.url}
Emails Found on Site: ${JSON.stringify(data.emailsFound)}

--- HOMEPAGE TEXT ---
${data.homepageText.slice(0, 3000)}

--- ABOUT US TEXT ---
${data.aboutText.slice(0, 3000)}

--- TEAM TEXT ---
${data.teamText.slice(0, 3000)}

--- CONTACT TEXT ---
${data.contactText.slice(0, 3000)}
`

  try {
    const client = getAiClient(settings)
    const responseText = await client.complete({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT.trim() },
        { role: 'user', content: prompt.trim() }
      ],
      temperature: 0.1,
    })

    // Clean markdown if present
    const cleaned = responseText.content.replace(/```json/g, '').replace(/```/g, '').trim()
    const result = JSON.parse(cleaned)
    return {
      contact_name: result.contact_name || null,
      role: result.role || null,
      direct_email: result.direct_email || null,
    }
  } catch (err) {
    console.error('[AI] Failed to extract decision maker:', err)
    return { contact_name: null, direct_email: null, role: null }
  }
}
