// electron/ai/tasks/generate-queries.ts
import { buildQueryGenerationPrompt } from '../prompts/query-generator'
import type { QueryProfile } from '../../../../shared/types/pipeline.types'
import type { AppSettings } from '../../../../shared/types'
import { getAiClient } from '../ai-client'

export interface GeneratedQuery {
  query: string
  city: string
  rationale: string
}

export async function generateQueriesFromProfile(
  settings: AppSettings,
  profile: QueryProfile,
  model = 'anthropic/claude-3-haiku'
): Promise<GeneratedQuery[]> {
  const prompt = buildQueryGenerationPrompt({
    label: profile.label,
    target_audience: profile.target_audience,
    core_offer: profile.core_offer,
    cities: JSON.parse(profile.cities)
  })

  const client = getAiClient(settings)
  const result = await client.completeJson<{ queries: GeneratedQuery[] }>({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  })

  return result.queries || []
}
