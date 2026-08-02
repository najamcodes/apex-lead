import type { AppSettings } from '../../../shared/types'
import { getDataSource } from '../../db'
import { AIConnectionEntity } from '../../db/entities/AIConnectionEntity'
import { decrypt } from '../utils/crypto'

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ContentPart[]
  name?: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface CompletionOptions {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
  response_format?: { type: 'json_object' } // force JSON output
  tools?: ToolDefinition[]
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } }
}

export interface CompletionResult {
  content: string
  model: string
  input_tokens: number
  output_tokens: number
  tool_calls?: ToolCall[]
}

export interface AIConnectionConfig {
  id?: string
  name?: string
  provider: 'openrouter' | 'openai' | 'groq' | 'gemini' | 'anthropic' | 'lmstudio' | 'ollama' | 'custom_openai' | 'custom_claude'
  baseUrl?: string | null
  apiKey?: string | null
  defaultModel?: string | null
}

export class AIClient {
  private config: AIConnectionConfig

  constructor(source: AppSettings | AIConnectionConfig) {
    if ('ai_provider' in source) {
      const settings = source as AppSettings
      const provider = settings.ai_provider || 'openrouter'
      let baseUrl: string | null = null
      let apiKey: string | null = null

      switch (provider) {
        case 'openai':
          apiKey = settings.openai_api_key
          baseUrl = 'https://api.openai.com/v1'
          break
        case 'anthropic':
          apiKey = settings.anthropic_api_key
          baseUrl = settings.anthropic_url || 'https://api.anthropic.com/v1'
          break
        case 'groq':
          apiKey = settings.groq_api_key
          baseUrl = 'https://api.groq.com/openai/v1'
          break
        case 'gemini':
          apiKey = settings.gemini_api_key
          baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai'
          break
        case 'lmstudio':
          apiKey = settings.lmstudio_key || 'lm-studio'
          baseUrl = settings.lmstudio_url || 'http://127.0.0.1:1234/v1'
          break
        case 'ollama':
          apiKey = settings.ollama_key || 'ollama'
          baseUrl = settings.ollama_url || 'http://127.0.0.1:11434/v1'
          break
        case 'custom_openai':
          apiKey = settings.custom_openai_key || 'custom-key'
          baseUrl = settings.custom_openai_url || 'http://localhost:8080/v1'
          break
        case 'custom_claude':
          apiKey = settings.custom_claude_key || 'claude-key'
          baseUrl = settings.custom_claude_url || 'http://localhost:8000/v1'
          break
        case 'openrouter':
        default:
          apiKey = settings.openrouter_api_key
          baseUrl = 'https://openrouter.ai/api/v1'
          break
      }

      this.config = {
        provider,
        baseUrl,
        apiKey,
        defaultModel: settings.ai_model_site_scoring || 'gpt-4o-mini',
      }
    } else {
      this.config = source as AIConnectionConfig
    }
  }

  getProvider(): string {
    return this.config.provider
  }

  getDefaultModel(): string | undefined {
    return this.config.defaultModel || undefined
  }

  async complete(options: CompletionOptions, retries = 1): Promise<CompletionResult> {
    const provider = this.config.provider || 'openrouter'

    // ─────────────────────────────────────────────────────────────
    // 1. Anthropic & Claude-compatible provider
    // ─────────────────────────────────────────────────────────────
    if (provider === 'anthropic' || provider === 'custom_claude') {
      return this.completeAnthropic(options, retries)
    }

    // ─────────────────────────────────────────────────────────────
    // 2. OpenAI-compatible providers
    // ─────────────────────────────────────────────────────────────
    const apiKey = this.config.apiKey || ''
    const rawBaseUrl = this.config.baseUrl ||
      (provider === 'openai' ? 'https://api.openai.com/v1' :
       provider === 'groq' ? 'https://api.groq.com/openai/v1' :
       provider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta/openai' :
       provider === 'lmstudio' ? 'http://127.0.0.1:1234/v1' :
       provider === 'ollama' ? 'http://127.0.0.1:11434/v1' :
       provider === 'custom_openai' ? 'http://localhost:8080/v1' :
       'https://openrouter.ai/api/v1')

    const baseUrl = rawBaseUrl.replace(/\/$/, '')

    if (!apiKey && provider !== 'lmstudio' && provider !== 'ollama' && provider !== 'custom_openai') {
      throw new Error(`API key not configured for AI provider: ${provider}.`)
    }

    try {
      const targetModel = options.model || this.config.defaultModel || 'gpt-4o-mini'
      const payload: Record<string, unknown> = {
        model: targetModel,
        messages: options.messages,
        max_tokens: options.max_tokens ?? 1500,
        temperature: options.temperature ?? 0.3,
        ...(options.response_format && { response_format: options.response_format }),
      }

      if (options.tools && options.tools.length > 0) {
        payload.tools = options.tools
        if (options.tool_choice) {
          payload.tool_choice = options.tool_choice
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://apexlead.app',
        'X-Title': 'ApexLead',
      }
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        if (response.status === 401) throw new Error('Authentication failed: Check your AI API key or local token.')
        if (response.status === 402) throw new Error('Add credits to your AI provider account.')
        if (response.status === 503) throw new Error('Model unavailable or local server offline.')

        if (retries > 0 && (response.status === 429 || response.status === 500)) {
          await new Promise((r) => setTimeout(r, response.status === 429 ? 2000 : 1000))
          return this.complete(options, retries - 1)
        }

        const err = await response.json().catch(() => ({}))
        throw new Error(
          `AI Provider error ${response.status}: ${(err as any)?.error?.message ?? (err as any)?.message ?? response.statusText}`
        )
      }

      const data = await response.json()
      const choice = data.choices?.[0]
      if (!choice) throw new Error('AI Provider returned no choices')

      return {
        content: choice.message?.content ?? '',
        model: data.model ?? targetModel,
        input_tokens: data.usage?.prompt_tokens ?? 0,
        output_tokens: data.usage?.completion_tokens ?? 0,
        tool_calls: choice.message?.tool_calls,
      }
    } catch (err: any) {
      if (err.message && err.message.includes('fetch')) {
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 1000))
          return this.complete(options, retries - 1)
        }
      }
      throw err
    }
  }

  private async completeAnthropic(options: CompletionOptions, retries = 1): Promise<CompletionResult> {
    const isCustom = this.config.provider === 'custom_claude'
    const apiKey = this.config.apiKey || (isCustom ? 'claude-key' : '')
    const rawBaseUrl = this.config.baseUrl ||
      (isCustom ? 'http://localhost:8000/v1' : 'https://api.anthropic.com/v1')
    
    const baseUrl = rawBaseUrl.replace(/\/$/, '')
    const endpoint = baseUrl.endsWith('/messages') ? baseUrl : `${baseUrl}/messages`

    if (!apiKey && !isCustom) {
      throw new Error('Anthropic API key is required.')
    }

    const systemMsg = options.messages.find(m => m.role === 'system')
    const systemPrompt = typeof systemMsg?.content === 'string' ? systemMsg.content : ''
    
    const claudeMessages = options.messages
      .filter(m => m.role !== 'system')
      .map(m => {
        if (m.role === 'tool') {
          return {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: m.tool_call_id || 'call_0',
                content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
              },
            ],
          }
        }
        if (Array.isArray(m.content)) {
          const parts = m.content.map(p => {
            if (p.type === 'text') return { type: 'text', text: p.text }
            if (p.type === 'image_url') {
              const url = p.image_url.url
              if (url.startsWith('data:')) {
                const match = url.match(/^data:([^;]+);base64,(.+)$/)
                if (match) {
                  return {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: match[1],
                      data: match[2],
                    },
                  }
                }
              }
              return { type: 'text', text: `[Image URL: ${url}]` }
            }
            return { type: 'text', text: '' }
          })
          return { role: m.role, content: parts }
        }
        return {
          role: m.role,
          content: m.content,
        }
      })

    let claudeTools: any[] | undefined
    if (options.tools && options.tools.length > 0) {
      claudeTools = options.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }))
    }

    const modelName = options.model || this.config.defaultModel || 'claude-3-5-sonnet-20241022'
    const payload: Record<string, unknown> = {
      model: modelName.includes('/') ? modelName.split('/')[1] : modelName,
      max_tokens: options.max_tokens ?? 1500,
      temperature: options.temperature ?? 0.3,
      messages: claudeMessages,
      ...(systemPrompt && { system: systemPrompt }),
      ...(claudeTools && { tools: claudeTools }),
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        if (response.status === 401) throw new Error('Anthropic authentication failed. Check your API key.')
        if (retries > 0 && (response.status === 429 || response.status >= 500)) {
          await new Promise((r) => setTimeout(r, 1500))
          return this.completeAnthropic(options, retries - 1)
        }
        const err = await response.json().catch(() => ({}))
        throw new Error(`Claude error ${response.status}: ${(err as any)?.error?.message || response.statusText}`)
      }

      const data = await response.json()
      let textContent = ''
      const toolCalls: ToolCall[] = []

      for (const block of data.content || []) {
        if (block.type === 'text') {
          textContent += block.text
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: typeof block.input === 'string' ? block.input : JSON.stringify(block.input),
            },
          })
        }
      }

      return {
        content: textContent,
        model: data.model || modelName,
        input_tokens: data.usage?.input_tokens ?? 0,
        output_tokens: data.usage?.output_tokens ?? 0,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      }
    } catch (err: any) {
      if (err.message && err.message.includes('fetch')) {
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 1000))
          return this.completeAnthropic(options, retries - 1)
        }
      }
      throw err
    }
  }

  async completeJson<T>(options: Omit<CompletionOptions, 'response_format'>): Promise<T> {
    const result = await this.complete({
      ...options,
      response_format: { type: 'json_object' },
    })

    try {
      const cleaned = (result.content || '')
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

// ─────────────────────────────────────────────────────────────────
// Resolver — picks named connection setup or falls back to settings default
// ─────────────────────────────────────────────────────────────────

export async function resolveAiClient(
  settings: AppSettings,
  connectionId?: string | null,
  orgId?: number,
): Promise<AIClient> {
  const ds = getDataSource()

  // 1. If explicit connection ID specified on node
  if (connectionId && connectionId !== 'default' && connectionId.trim() !== '') {
    try {
      const repo = ds.getRepository(AIConnectionEntity)
      const conn = await repo.findOneBy({ id: connectionId })
      if (conn) {
        return new AIClient({
          id: conn.id,
          name: conn.name,
          provider: conn.provider,
          baseUrl: conn.base_url,
          apiKey: conn.api_key ? decrypt(conn.api_key) : null,
          defaultModel: conn.default_model,
        })
      }
    } catch {
      // Fallback
    }
  }

  // 2. If no explicit connection ID, check if a default AI Connection profile is set in DB
  if (orgId) {
    try {
      const repo = ds.getRepository(AIConnectionEntity)
      const defaultConn = await repo.findOneBy({ org_id: orgId, is_default: true })
      if (defaultConn) {
        return new AIClient({
          id: defaultConn.id,
          name: defaultConn.name,
          provider: defaultConn.provider,
          baseUrl: defaultConn.base_url,
          apiKey: defaultConn.api_key ? decrypt(defaultConn.api_key) : null,
          defaultModel: defaultConn.default_model,
        })
      }
    } catch {
      // Fallback
    }
  }

  // 3. Fallback to global desktop settings
  return new AIClient(settings)
}

let _client: AIClient | null = null

export function getAiClient(settings: AppSettings): AIClient {
  if (!_client) {
    _client = new AIClient(settings)
  }
  return _client
}

export function resetAiClient(): void {
  _client = null
}
