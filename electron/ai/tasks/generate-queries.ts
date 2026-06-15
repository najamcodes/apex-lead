// electron/ai/tasks/generate-queries.ts
import { buildQueryGenerationPrompt } from '../prompts/query-generator'
import type { QueryProfile } from '../../../src/types/pipeline.types'

export interface GeneratedQuery {
  query: string
  city: string
  rationale: string
}

export async function generateQueriesFromProfile(
  apiKey: string,
  profile: QueryProfile,
  model = 'anthropic/claude-3-haiku'
): Promise<GeneratedQuery[]> {
  const prompt = buildQueryGenerationPrompt({
    label: profile.label,
    target_audience: profile.target_audience,
    core_offer: profile.core_offer,
    cities: JSON.parse(profile.cities)
  })

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'LeadHunter',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter API error: ${err}`)
  }

  const data = await res.json()
  let content = data.choices[0]?.message?.content || '[]'
  
  // Strip markdown code blocks if the model wrapped the JSON
  content = content.replace(/```json/gi, '').replace(/```/g, '').trim()

  try {
    const queries = JSON.parse(content)
    return queries
  } catch (e) {
    console.error('Failed to parse query generator response:', content)
    return []
  }
}
