// electron/ai/openrouter-client.ts
// Thin wrapper around OpenRouter's OpenAI-compatible /chat/completions endpoint.
// All AI calls in the app go through this — never call fetch directly from tasks.

import { OPENROUTER_BASE_URL } from './models'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
  response_format?: { type: 'json_object' } // force JSON output
}

export interface CompletionResult {
  content: string
  model: string
  input_tokens: number
  output_tokens: number
}

export class OpenRouterClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async complete(options: CompletionOptions, retries = 1): Promise<CompletionResult> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured. Add it in Settings.')
    }

    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://leadhunter.app', // identifies your app in OpenRouter dashboard
          'X-Title': 'LeadHunter'
        },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          max_tokens: options.max_tokens ?? 1024,
          temperature: options.temperature ?? 0.3,
          ...(options.response_format && { response_format: options.response_format })
        })
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Check your OpenRouter API key in Settings')
        }
        if (response.status === 402) {
          throw new Error('Add credits at openrouter.ai/credits')
        }
        if (response.status === 503) {
          throw new Error('Model unavailable, try switching to backup model')
        }

        // Handle retries for 429 and 500
        if (retries > 0 && (response.status === 429 || response.status === 500)) {
          await new Promise((r) => setTimeout(r, response.status === 429 ? 2000 : 1000))
          return this.complete(options, retries - 1)
        }

        const err = await response.json().catch(() => ({}))
        throw new Error(
          `OpenRouter error ${response.status}: ${(err as any)?.error?.message ?? response.statusText}`
        )
      }

      const data = await response.json()
      const choice = data.choices?.[0]
      if (!choice) throw new Error('OpenRouter returned no choices')

      return {
        content: choice.message?.content ?? '',
        model: data.model ?? options.model,
        input_tokens: data.usage?.prompt_tokens ?? 0,
        output_tokens: data.usage?.completion_tokens ?? 0
      }
    } catch (err: any) {
      if (err.message && err.message.includes('fetch')) {
        // It might be a network error, treat it like a 500 for retry
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 1000))
          return this.complete(options, retries - 1)
        }
      }
      throw err
    }
  }

  // Convenience: complete and parse JSON response
  async completeJson<T>(options: Omit<CompletionOptions, 'response_format'>): Promise<T> {
    const result = await this.complete({
      ...options,
      response_format: { type: 'json_object' }
    })

    try {
      // Strip markdown fences if model wraps JSON anyway
      const cleaned = result.content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
      return JSON.parse(cleaned) as T
    } catch {
      throw new Error(`Failed to parse JSON from model response: ${result.content.slice(0, 200)}`)
    }
  }
}

// Singleton — rebuilt when API key changes
let _client: OpenRouterClient | null = null

export function getAiClient(apiKey: string): OpenRouterClient {
  if (!_client || _client['apiKey'] !== apiKey) {
    _client = new OpenRouterClient(apiKey)
  }
  return _client
}

export function resetAiClient(): void {
  _client = null
}
