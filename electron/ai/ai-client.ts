import type { AppSettings } from '../../src/types'
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

export class AIClient {
  private settings: AppSettings

  constructor(settings: AppSettings) {
    this.settings = settings
  }

  async complete(options: CompletionOptions, retries = 1): Promise<CompletionResult> {
    let apiKey = ''
    let baseUrl = ''

    switch (this.settings.ai_provider) {
      case 'openai':
        apiKey = this.settings.openai_api_key
        baseUrl = 'https://api.openai.com/v1'
        break
      case 'groq':
        apiKey = this.settings.groq_api_key
        baseUrl = 'https://api.groq.com/openai/v1'
        break
      case 'gemini':
        apiKey = this.settings.gemini_api_key
        baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai'
        break
      case 'lmstudio':
        apiKey = 'lmstudio' // some local endpoints don't need a key, but fetch might fail if empty
        baseUrl = (this.settings.lmstudio_url || '').replace(/\/$/, '')
        break
      case 'ollama':
        apiKey = 'ollama'
        baseUrl = (this.settings.ollama_url || '').replace(/\/$/, '')
        break
      case 'openrouter':
      default:
        apiKey = this.settings.openrouter_api_key
        baseUrl = 'https://openrouter.ai/api/v1'
        break
    }

    if (!apiKey) {
      throw new Error(`API key not configured for provider: ${this.settings.ai_provider}. Add it in Settings.`)
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
          throw new Error('Check your AI API key in Settings')
        }
        if (response.status === 402) {
          throw new Error('Add credits to your AI provider account')
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
          `AI Provider error ${response.status}: ${(err as any)?.error?.message ?? response.statusText}`
        )
      }

      const data = await response.json()
      const choice = data.choices?.[0]
      if (!choice) throw new Error('AI Provider returned no choices')

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

// Singleton — rebuilt when settings change
let _client: AIClient | null = null

export function getAiClient(settings: AppSettings): AIClient {
  if (!_client || JSON.stringify(_client['settings']) !== JSON.stringify(settings)) {
    _client = new AIClient(settings)
  }
  return _client
}

export function resetAiClient(): void {
  _client = null
}
