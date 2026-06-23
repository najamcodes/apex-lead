// electron/ai/prompts/email-drafter.ts

export const EMAIL_DRAFTER_SYSTEM = `You are a sales copywriter for a freelance web developer.
Write concise, personalized cold outreach. Never use generic phrases like "I hope this finds you well".
Return JSON only — no preamble.`

export function buildEmailDrafterPrompt(data: {
  business_name: string
  category: string
  city: string
  website_url: string | null
  site_score: number | null
  site_summary: string | null
  site_issues: string[]
  opportunity: string | null
  developer_name: string
  contact_name: string | null
}): string {
  const hasWebsite = !!data.website_url
  const siteContext = hasWebsite
    ? `Their current website scored ${data.site_score}/100. Main issue: ${data.site_summary}. Problems: ${data.site_issues.slice(0, 2).join(', ')}.`
    : `They have NO website at all.`

  return `Write outreach for this prospect:
Business: ${data.business_name}
Type: ${data.category} in ${data.city}
Website situation: ${siteContext}
Opportunity: ${data.opportunity ?? 'Needs a modern website'}
Developer name: ${data.developer_name}
${data.contact_name ? `Recipient name: ${data.contact_name} (Address them by this name)` : ''}

Return JSON only:
{
  "subject": "<email subject line, under 50 chars, personalized>",
  "email_body": "<3-4 short paragraphs, under 150 words total, ends with soft CTA>",
  "linkedin_dm": "<1-2 sentences, under 50 words, casual tone>"
}`
}
