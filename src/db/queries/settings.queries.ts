// src/db/queries/settings.queries.ts
// Settings stored as key-value pairs in the `settings` table (created in Phase 1 schema).

import { getDb } from '../index'
import type { AppSettings } from '../../types'

const DEFAULTS: AppSettings = {
  proxy_enabled: false,
  proxy_url: '',
  proxy_username: '',
  proxy_password: '',
  claude_api_key: '',           // legacy — not used, OpenRouter replaces this
  pagespeed_api_key: '',
  scrape_delay_ms: 1500,
  max_results_per_run: 100,
  default_country: 'Pakistan',
  default_city: '',
  openrouter_api_key: '',
  ai_model_site_scoring: 'deepseek/deepseek-v4-flash',
  ai_model_email_draft: 'deepseek/deepseek-v4-flash',
  ai_enabled: true,
  developer_name: '',
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
  auto_send_cron: '0 * * * *',
  theme: 'dark',
}

export function getSettings(): AppSettings {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const stored: Record<string, string> = {}
  for (const row of rows) stored[row.key] = row.value

  // Merge stored values over defaults, handling type coercion
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
    ),
  } as AppSettings
}

export function saveSettings(settings: Partial<AppSettings>): void {
  const db = getDb()
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  const tx = db.transaction((data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      upsert.run(key, String(value))
    }
  })
  tx(settings as Record<string, unknown>)
}
