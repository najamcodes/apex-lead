import { getTenantId } from './tenant'
import { getDataSource } from '../index'
import { SettingsEntity } from '../entities/SettingsEntity'
import type { AppSettings } from '../../../shared/types'
import { encrypt, decrypt } from '@sdk/core/utils/crypto'

export const SENSITIVE_KEYS = [
  'proxy_password',
  'claude_api_key',
  'pagespeed_api_key',
  'openrouter_api_key',
  'openai_api_key',
  'groq_api_key',
  'gemini_api_key',
  'anthropic_api_key',
  'custom_openai_key',
  'custom_claude_key',
  'lmstudio_key',
  'ollama_key',
  'smtp_password',
  'hunter_api_key',
  'two_captcha_key'
]

export const DEFAULTS: AppSettings = {
  proxy_enabled: false,
  proxy_url: '',
  proxy_username: '',
  proxy_password: '',
  claude_api_key: '',
  pagespeed_api_key: '',
  scrape_delay_ms: 1200,
  max_results_per_run: 100,
  default_country: '',
  default_city: '',
  seo_audit_engine: 'pagespeed',
  openrouter_api_key: '',
  ai_provider: 'openrouter',
  openai_api_key: '',
  groq_api_key: '',
  gemini_api_key: '',
  lmstudio_url: 'http://127.0.0.1:1234/v1',
  lmstudio_key: '',
  ollama_url: 'http://127.0.0.1:11434/v1',
  ollama_key: '',
  anthropic_api_key: '',
  anthropic_url: 'https://api.anthropic.com/v1',
  custom_openai_url: 'http://localhost:8080/v1',
  custom_openai_key: '',
  custom_claude_url: 'http://localhost:8000/v1',
  custom_claude_key: '',
  ai_model_site_scoring: 'anthropic/claude-3-haiku',
  ai_model_email_draft: 'anthropic/claude-3-5-sonnet',
  ai_enabled: false,
  smtp_host: '',
  smtp_port: 587,
  smtp_secure: false,
  smtp_username: '',
  smtp_password: '',
  smtp_from_name: '',
  smtp_from_email: '',
  hunter_api_key: '',
  email_finder_enabled: false,
  auto_send_enabled: false,
  auto_send_cron: '0 9 * * *',
  theme: 'dark',
  captcha_strategy: 'pause',
  two_captcha_key: '',
  captcha_timeout_s: 120,
  scraper_headful: false,

  pipeline_enabled: false,
  pipeline_scrape_cron: '0 2 * * *',
  pipeline_digest_cron: '0 7 * * *',
  digest_recipient_email: '',
  digest_from_name: 'ApexLead',
  auto_approve_threshold: 0,
  auto_sequence_on_approve: false,
  discord_webhook_url: '',
  use_ai_for_outreach: true,
  default_email_template_id: null,
  imap_cron: '*/5 * * * *',
  warmup_cron: '*/30 * * * *',
  outreach_disabled: false
}

export async function getSettings(maskSensitive = false): Promise<AppSettings> {
  const repo = getDataSource().getRepository(SettingsEntity)
  const rows = await repo.find({ where: { org_id: getTenantId() } })
  const stored: Record<string, string> = {}
  for (const row of rows) {
    if (SENSITIVE_KEYS.includes(row.key)) {
      if (maskSensitive && row.value) {
        stored[row.key] = '********'
      } else {
        stored[row.key] = decrypt(row.value)
      }
    } else {
      stored[row.key] = row.value
    }
  }

  return {
    ...DEFAULTS,
    ...Object.fromEntries(
      Object.entries(stored).map(([k, v]) => {
        if (v === 'true') return [k, true]
        if (v === 'false') return [k, false]
        const n = Number(v)
        if (!isNaN(n) && v !== '') return [k, n]
        return [k, v]
      })
    )
  } as AppSettings
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const repo = getDataSource().getRepository(SettingsEntity)
  
  const entitiesToSave: SettingsEntity[] = []
  
  for (const [key, rawValue] of Object.entries(settings)) {
    if (SENSITIVE_KEYS.includes(key) && rawValue === '********') {
      continue // Do not overwrite with masked string
    }
    
    let finalValue = String(rawValue)
    if (SENSITIVE_KEYS.includes(key) && finalValue) {
      finalValue = encrypt(finalValue)
    }
    
    entitiesToSave.push(repo.create({
      org_id: getTenantId(),
      key,
      value: finalValue
    }))
  }

  if (entitiesToSave.length > 0) {
    await repo.save(entitiesToSave)
  }
}
