// src/screens/Settings/ApiKeySettings.tsx
import { useState } from 'react'
import { Input } from '../../components/ui/Input'

import type { AppSettings } from '../../types'

const MODEL_OPTIONS = [
  { value: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash (cheapest — recommended)' },
  { value: 'deepseek/deepseek-v4-flash:free', label: 'DeepSeek V4 Flash Free (rate-limited)' },
  { value: 'qwen/qwen3.6-flash', label: 'Qwen 3.6 Flash (fallback)' },
  { value: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro (best quality, higher cost)' }
]

interface Props {
  settings: AppSettings
  onSave: (patch: Partial<AppSettings>) => void
}

export function ApiKeySettings({ settings, onSave }: Props) {
  const [provider, setProvider] = useState(settings.ai_provider || 'openrouter')

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as any
    setProvider(val)
    onSave({ ai_provider: val })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-zinc-400 block mb-1.5">
          Active AI Provider
        </label>
        <select
          className="w-full px-3 py-2 rounded-md text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 outline-none focus:border-emerald-500 transition-colors"
          value={provider}
          onChange={handleProviderChange}
        >
          <option value="openrouter">OpenRouter (Recommended)</option>
          <option value="openai">OpenAI</option>
          <option value="groq">Groq</option>
          <option value="gemini">Google Gemini</option>
          <option value="lmstudio">LM Studio (Local)</option>
          <option value="ollama">Ollama (Local)</option>
        </select>
      </div>

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
            — free tier available.
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
        <Input
          label="LM Studio Base URL"
          type="text"
          placeholder="http://127.0.0.1:1234/v1"
          defaultValue={settings.lmstudio_url}
          onBlur={(e) => onSave({ lmstudio_url: e.target.value })}
        />
      )}

      {provider === 'ollama' && (
        <Input
          label="Ollama Base URL"
          type="text"
          placeholder="http://127.0.0.1:11434/v1"
          defaultValue={settings.ollama_url}
          onBlur={(e) => onSave({ ollama_url: e.target.value })}
        />
      )}

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
          placeholder="e.g. gpt-4o or llama3-8b-8192"
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
          placeholder="e.g. gpt-4o or llama3-8b-8192"
        />
        <datalist id="drafting-models">
          {MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </datalist>
      </div>

      <div className="bg-zinc-800/50 rounded-lg px-4 py-3 text-xs text-zinc-400 space-y-1">
        <p className="font-medium text-zinc-300">Estimated costs</p>
        <p>• Site scoring 100 leads → ~$0.005</p>
        <p>• Email drafting 100 leads → ~$0.009</p>
        <p>• 1,000 leads/month fully processed → ~$0.15–$0.20</p>
      </div>
    </div>
  )
}
