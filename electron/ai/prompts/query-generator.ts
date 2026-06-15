export function buildQueryGenerationPrompt(profile: {
  label: string
  target_audience: string
  core_offer: string
  cities: string[]
}) {
  return `
You are an expert lead generation strategist. Your goal is to generate highly specific, long-tail search queries that will uncover hidden, high-value businesses in Google Maps.

--- TARGET PROFILE ---
Profile Name: ${profile.label}
Who we are targeting: ${profile.target_audience}
What we are selling: ${profile.core_offer}
Target Cities: ${profile.cities.join(', ')}
----------------------

### INSTRUCTIONS:
1. Think deeply about what specific types of businesses fall into the "Target Audience". 
   - E.g., if the audience is "High-end Home Services", generate queries for: "Luxury custom home builders", "Architectural landscape design", "Boutique interior designers".
2. Combine these specific niches with the provided "Target Cities" to create exact Google Maps search queries.
3. Generate exactly 10 highly targeted queries.
4. Output ONLY valid JSON in the following format, with no markdown formatting, no backticks, and no explanations.

### OUTPUT FORMAT:
[
  { "query": "[Niche] in [City]", "city": "[City]", "rationale": "Why this niche is likely to buy the core offer" },
  ...
]
`
}
