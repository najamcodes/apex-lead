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
}): string {
  if (!data.website_url) {
    return `Business: "${data.business_name}" has NO website.
Return JSON: { "score": 0, "verdict": "none", "summary": "No website found", "issues": ["No website"], "opportunity": "This business has no online presence and needs a website urgently." }`
  }

  return `Evaluate this business website:
Business: ${data.business_name}
URL: ${data.website_url}
PageSpeed mobile: ${data.pagespeed_mobile ?? 'unknown'}/100
PageSpeed desktop: ${data.pagespeed_desktop ?? 'unknown'}/100
SSL: ${data.ssl_valid === true ? 'valid' : data.ssl_valid === false ? 'INVALID' : 'unknown'}
Tech stack: ${data.tech_stack ?? 'unknown'}
Estimated build year: ${data.site_built_year ?? 'unknown'}

Return JSON only:
{
  "score": <0-100>,
  "verdict": <"poor"|"outdated"|"average"|"good"|"excellent">,
  "summary": "<one sentence describing the site's main problem>",
  "issues": ["<issue 1>", "<issue 2>"],
  "opportunity": "<one sentence pitch hook a web developer would use>"
}`
}
