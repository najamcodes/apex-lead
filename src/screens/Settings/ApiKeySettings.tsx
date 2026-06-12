// src/screens/Settings/ApiKeySettings.tsx
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
  return (
    <div className="space-y-4">
      <Input
        label="OpenRouter API Key"
        type="password"
        placeholder="sk-or-..."
        defaultValue={settings.openrouter_api_key}
        onBlur={(e) => onSave({ openrouter_api_key: e.target.value })}
      />
      <Input
        label="Google PageSpeed API Key (optional)"
        type="password"
        placeholder="AIza..."
        defaultValue={settings.pagespeed_api_key}
        onBlur={(e) => onSave({ pagespeed_api_key: e.target.value })}
      />
      <p className="text-xs text-zinc-500">
        Get your key at{' '}
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noreferrer"
          className="text-emerald-400 hover:underline"
        >
          openrouter.ai/keys
        </a>{' '}
        — free tier available, no credit card required.
      </p>

      <div>
        <label className="text-xs font-medium text-zinc-400 block mb-1.5">
          Model for site scoring
        </label>
        <select
          className="w-full px-3 py-2 rounded-md text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 outline-none focus:border-emerald-500 transition-colors"
          defaultValue={settings.ai_model_site_scoring}
          onChange={(e) => onSave({ ai_model_site_scoring: e.target.value })}
        >
          {MODEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 block mb-1.5">
          Model for email drafting
        </label>
        <select
          className="w-full px-3 py-2 rounded-md text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 outline-none focus:border-emerald-500 transition-colors"
          defaultValue={settings.ai_model_email_draft}
          onChange={(e) => onSave({ ai_model_email_draft: e.target.value })}
        >
          {MODEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
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
