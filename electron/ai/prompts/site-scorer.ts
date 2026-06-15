// electron/ai/prompts/site-scorer.ts
// System and user prompts for website quality analysis.
// Keep prompts short — we're paying per token.

export const SITE_SCORER_SYSTEM = `You are a web developer evaluating business websites for quality and modernity.
Analyze the provided website information and return a JSON object ONLY — no preamble, no explanation.`

export function buildSiteScorerPrompt(data: {
  business_name: string
  website_url: string | null
  pagespeed_mobile: number | null
  pagespeed_desktop: number | null
  ssl_valid: boolean | null
  tech_stack: string | null
  site_built_year: number | null
  site_content?: string | null
  contact_page_content?: string | null
  seo_metrics?: string | null
}): string {
  if (!data.website_url) {
    return `Business: "${data.business_name}" has NO website.
Return JSON: { "score": 0, "verdict": "none", "summary": "No website found", "issues": ["No website"], "opportunity_hook": "I noticed you don't have a website yet, which makes it hard for locals to find you online.", "icebreaker": null, "decision_maker_name": null }`
  }

  return `Evaluate this business website:
Business: ${data.business_name}
URL: ${data.website_url}
PageSpeed mobile: ${data.pagespeed_mobile ?? 'unknown'}/100
PageSpeed desktop: ${data.pagespeed_desktop ?? 'unknown'}/100
SSL: ${data.ssl_valid === true ? 'valid' : data.ssl_valid === false ? 'INVALID' : 'unknown'}
Tech stack: ${data.tech_stack ?? 'unknown'}
Estimated build year: ${data.site_built_year ?? 'unknown'}
Failed SEO/Accessibility Audits: ${data.seo_metrics ?? 'none'}

Homepage Content:
---
${data.site_content ? data.site_content.slice(0, 2000) : 'No content'}
---

About/Contact Page Content:
---
${data.contact_page_content ? data.contact_page_content.slice(0, 1500) : 'No content'}
---

Return JSON only:
{
  "score": <0-100>,
  "verdict": <"poor"|"outdated"|"average"|"good"|"excellent">,
  "summary": "<one sentence describing the site's main problem>",
  "issues": ["<issue 1>", "<issue 2>"],
  "opportunity_hook": "<1-2 sentence personalized cold email hook mentioning exactly what they do, and identifying a gap or opportunity. Use the Failed SEO/Accessibility Audits if applicable. Make it sound natural and human. Do not use generic phrases.>",
  "icebreaker": "<A personalized 1-sentence compliment or observation based on their website copy, e.g. 'I loved your recent case study on the downtown plumbing project'>",
  "decision_maker_name": "<If a founder, owner, or team member name is found in the text, put it here. Otherwise null>"
}`
}
