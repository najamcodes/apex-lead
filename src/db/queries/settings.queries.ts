import { getDataSource } from '../index'
import { SettingsEntity } from '../entities/SettingsEntity'
import type { AppSettings } from '../../types'

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
  scraper_headful: false
}

export async function getSettings(): Promise<AppSettings> {
  const repo = getDataSource().getRepository(SettingsEntity)
  const rows = await repo.find()
  const stored: Record<string, string> = {}
  for (const row of rows) stored[row.key] = row.value

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
  const entities = Object.entries(settings).map(([key, value]) => {
    return repo.create({ key, value: String(value) })
  })

  await repo.save(entities)
}
