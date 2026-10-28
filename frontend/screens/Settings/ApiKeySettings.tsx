// src/screens/Settings/ApiKeySettings.tsx
import { useState } from 'react'
import { Input } from '../../components/ui/Input'
import { api } from '../../services/api'
import type { AppSettings } from '@sdk/core/types'
import { CheckCircle2, XCircle, RefreshCw, Sparkles, Server, Zap, Cpu } from 'lucide-react'
import toast from 'react-hot-toast'

const MODEL_OPTIONS = [
  { value: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash (cheapest — recommended)' },
  { value: 'deepseek/deepseek-v4-flash:free', label: 'DeepSeek V4 Flash Free (rate-limited)' },
  { value: 'gpt-4o-mini', label: 'OpenAI GPT-4o Mini' },
  { value: 'gpt-4o', label: 'OpenAI GPT-4o' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  { value: 'llama3.1', label: 'Ollama Llama 3.1 / LM Studio Local' },
  { value: 'qwen/qwen3.6-flash', label: 'Qwen 3.6 Flash' },
]

interface Props {
  settings: AppSettings
  onSave: (patch: Partial<AppSettings>) => void
}

export function ApiKeySettings({ settings, onSave }: Props) {
  const [provider, setProvider] = useState(settings.ai_provider || 'openrouter')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latency?: number } | null>(null)

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as any
    setProvider(val)
    setTestResult(null)
    onSave({ ai_provider: val })
  }

  const handleTestConnection = async () => {
    try {
      setTesting(true)
      setTestResult(null)
      const res = await api.ai.testConnection({ ai_provider: provider })
      if (res.ok) {
        setTestResult({
          ok: true,
          message: `Connected successfully to ${res.provider} (${res.model})!`,
          latency: res.latencyMs,
        })
        toast.success(`AI Connection successful (${res.latencyMs}ms)!`)
      } else {
        setTestResult({
          ok: false,
          message: res.error || 'Connection failed',
          latency: res.latencyMs,
        })
        toast.error(`Connection failed: ${res.error}`)
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err.message || 'Failed to reach AI endpoint',
      })
      toast.error(`Test failed: ${err.message}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-zinc-400 block">
            Active AI Provider
          </label>
          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Supports Local & Cloud LLMs
          </span>
        </div>

        <select
          className="w-full px-3 py-2 rounded-md text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 outline-none focus:border-emerald-500 transition-colors"
          value={provider}
          onChange={handleProviderChange}
        >
          <optgroup label="Cloud Providers">
            <option value="openrouter">OpenRouter (Multi-Model Hub)</option>
            <option value="openai">OpenAI (Official GPT-4o / O1)</option>
            <option value="anthropic">Anthropic (Claude 3.5 Sonnet / Haiku)</option>
            <option value="gemini">Google Gemini (Flash / Pro)</option>
            <option value="groq">Groq (Ultra-Fast Inference)</option>
          </optgroup>
          <optgroup label="Local Inference Engines">
            <option value="lmstudio">LM Studio (Local GUI Server)</option>
            <option value="ollama">Ollama (Local Server / CLI)</option>
          </optgroup>
          <optgroup label="Custom Endpoints & Gateways">
            <option value="custom_openai">Custom OpenAI-Compatible Endpoint (vLLM / LocalAI / Jan)</option>
            <option value="custom_claude">Custom Claude-Compatible Endpoint</option>
          </optgroup>
        </select>
      </div>

      {/* Provider Details */}
      {provider === 'openrouter' && (
        <>
          <Input
            label="OpenRouter API Key"
            type="password"
            placeholder="sk-or-..."
            defaultValue={settings.openrouter_api_key}
            onBlur={(e) => onSave({ openrouter_api_key: e.target.value })}
          />
          <p className="text-xs text-zinc-500">
            Get your key at{' '}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
              openrouter.ai/keys
            </a>{' '}
            — supports Claude, GPT-4o, DeepSeek, and Llama.
          </p>
        </>
      )}

      {provider === 'openai' && (
        <Input
          label="OpenAI API Key"
          type="password"
          placeholder="sk-..."
          defaultValue={settings.openai_api_key}
          onBlur={(e) => onSave({ openai_api_key: e.target.value })}
        />
      )}

      {provider === 'anthropic' && (
        <div className="space-y-3">
          <Input
            label="Anthropic Claude API Key"
            type="password"
            placeholder="sk-ant-..."
            defaultValue={settings.anthropic_api_key}
            onBlur={(e) => onSave({ anthropic_api_key: e.target.value })}
          />
          <Input
            label="Anthropic Base URL"
            type="text"
            placeholder="https://api.anthropic.com/v1"
            defaultValue={settings.anthropic_url || 'https://api.anthropic.com/v1'}
            onBlur={(e) => onSave({ anthropic_url: e.target.value })}
          />
        </div>
      )}

      {provider === 'groq' && (
        <Input
          label="Groq API Key"
          type="password"
          placeholder="gsk_..."
          defaultValue={settings.groq_api_key}
          onBlur={(e) => onSave({ groq_api_key: e.target.value })}
        />
      )}

      {provider === 'gemini' && (
        <Input
          label="Google Gemini API Key"
          type="password"
          placeholder="AIza..."
          defaultValue={settings.gemini_api_key}
          onBlur={(e) => onSave({ gemini_api_key: e.target.value })}
        />
      )}

      {provider === 'lmstudio' && (
        <div className="space-y-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2 text-xs text-zinc-300 font-semibold">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>LM Studio Local Server Setup</span>
          </div>
          <Input
            label="LM Studio Local Server Base URL"
            type="text"
            placeholder="http://127.0.0.1:1234/v1"
            defaultValue={settings.lmstudio_url || 'http://127.0.0.1:1234/v1'}
            onBlur={(e) => onSave({ lmstudio_url: e.target.value })}
          />
          <Input
            label="API Key / Bearer Token (Optional)"
            type="password"
            placeholder="Leave blank or enter token"
            defaultValue={settings.lmstudio_key || ''}
            onBlur={(e) => onSave({ lmstudio_key: e.target.value })}
          />
          <p className="text-[11px] text-zinc-500">
            Start the Local Server inside LM Studio (Port 1234) and load any model (e.g. Llama 3, Qwen 2.5, Mistral).
          </p>
        </div>
      )}

      {provider === 'ollama' && (
        <div className="space-y-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2 text-xs text-zinc-300 font-semibold">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Ollama Local / Remote Server Setup</span>
          </div>
          <Input
            label="Ollama Server Base URL"
            type="text"
            placeholder="http://127.0.0.1:11434/v1"
            defaultValue={settings.ollama_url || 'http://127.0.0.1:11434/v1'}
            onBlur={(e) => onSave({ ollama_url: e.target.value })}
          />
          <Input
            label="API Key / Auth Token (Optional)"
            type="password"
            placeholder="Optional for remote protected Ollama instances"
            defaultValue={settings.ollama_key || ''}
            onBlur={(e) => onSave({ ollama_key: e.target.value })}
          />
          <p className="text-[11px] text-zinc-500">
            Ensure Ollama is running (`ollama serve`). Supports `llama3`, `mistral`, `qwen`, `deepseek-coder`, etc.
          </p>
        </div>
      )}

      {provider === 'custom_openai' && (
        <div className="space-y-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2 text-xs text-zinc-300 font-semibold">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Custom OpenAI-Compatible Gateway</span>
          </div>
          <Input
            label="OpenAI-Compatible Base URL"
            type="text"
            placeholder="http://localhost:8080/v1 or https://api.together.xyz/v1"
            defaultValue={settings.custom_openai_url || 'http://localhost:8080/v1'}
            onBlur={(e) => onSave({ custom_openai_url: e.target.value })}
          />
          <Input
            label="Custom API Key / Bearer Token"
            type="password"
            placeholder="sk-custom-... or leave empty for unauthenticated local endpoints"
            defaultValue={settings.custom_openai_key || ''}
            onBlur={(e) => onSave({ custom_openai_key: e.target.value })}
          />
        </div>
      )}

      {provider === 'custom_claude' && (
        <div className="space-y-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2 text-xs text-zinc-300 font-semibold">
            <Zap className="w-4 h-4 text-purple-400" />
            <span>Custom Claude-Compatible Gateway</span>
          </div>
          <Input
            label="Claude-Compatible Base URL"
            type="text"
            placeholder="http://localhost:8000/v1"
            defaultValue={settings.custom_claude_url || 'http://localhost:8000/v1'}
            onBlur={(e) => onSave({ custom_claude_url: e.target.value })}
          />
          <Input
            label="Custom Claude API Key"
            type="password"
            placeholder="API Key / Token"
            defaultValue={settings.custom_claude_key || ''}
            onBlur={(e) => onSave({ custom_claude_key: e.target.value })}
          />
        </div>
      )}

      {/* Test Connection Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-md text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
          <span>{testing ? 'Testing Endpoint...' : `Test ${provider.toUpperCase()} Connection`}</span>
        </button>

        {testResult && (
          <div
            className={`mt-2 p-2.5 rounded-md text-xs flex items-center justify-between ${
              testResult.ok
                ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                : 'bg-red-950/60 border border-red-800 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
              <span>{testResult.message}</span>
            </div>
            {testResult.latency !== undefined && (
              <span className="font-mono text-[11px] font-bold">{testResult.latency}ms</span>
            )}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-zinc-800">
        <Input
          label="Google PageSpeed API Key (optional)"
          type="password"
          placeholder="AIza..."
          defaultValue={settings.pagespeed_api_key}
          onBlur={(e) => onSave({ pagespeed_api_key: e.target.value })}
        />
      </div>

      <div className="pt-2 border-t border-zinc-800">
        <label className="text-xs font-medium text-zinc-400 block mb-1.5">
          SEO Audit Engine
        </label>
        <select
          className="w-full px-3 py-2 rounded-md text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 outline-none focus:border-emerald-500 transition-colors"
          defaultValue={settings.seo_audit_engine}
          onChange={(e) => onSave({ seo_audit_engine: e.target.value as any })}
        >
          <option value="pagespeed">Google PageSpeed API (Fast/Lightweight)</option>
          <option value="lighthouse">Local Lighthouse (Heavy/Requires Chrome)</option>
          <option value="none">Disabled</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 block mb-1.5">
          Model for site scoring
        </label>
        <input
          type="text"
          list="scoring-models"
          className="w-full px-3 py-2 rounded-md text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 outline-none focus:border-emerald-500 transition-colors"
          defaultValue={settings.ai_model_site_scoring}
          onBlur={(e) => onSave({ ai_model_site_scoring: e.target.value })}
          placeholder="e.g. gpt-4o or llama3"
        />
        <datalist id="scoring-models">
          {MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </datalist>
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 block mb-1.5">
          Model for email drafting
        </label>
        <input
          type="text"
          list="drafting-models"
          className="w-full px-3 py-2 rounded-md text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 outline-none focus:border-emerald-500 transition-colors"
          defaultValue={settings.ai_model_email_draft}
          onBlur={(e) => onSave({ ai_model_email_draft: e.target.value })}
          placeholder="e.g. gpt-4o or llama3"
        />
        <datalist id="drafting-models">
          {MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </datalist>
      </div>
    </div>
  )
}
