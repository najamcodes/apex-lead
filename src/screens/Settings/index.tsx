// src/screens/Settings/index.tsx
import { useEffect, useState } from 'react'
import { useSettingsStore } from '../../store/settings.store'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { ApiKeySettings } from './ApiKeySettings'
import { EmailAccountsManager } from './EmailAccountsManager'
import { EmailTemplatesManager } from './EmailTemplatesManager'

export function Settings() {
  const { settings, loaded, saving, load, save } = useSettingsStore()
  const [templates, setTemplates] = useState<any[]>([])

  useEffect(() => {
    load()
    window.api.templates.getAll().then(setTemplates)
  }, [])
  if (!loaded || !settings) return null

  return (
    <form
      className="space-y-6 max-w-2xl"
      onSubmit={(e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        save({
          developer_name: (formData.get('developer_name') as string) || '',
          proxy_enabled: (formData.get('proxy_enabled') as string) === 'on',
          proxy_url: (formData.get('proxy_url') as string) || '',
          proxy_username: (formData.get('proxy_username') as string) || '',
          proxy_password: (formData.get('proxy_password') as string) || '',
          default_city: (formData.get('default_city') as string) || '',
          default_country: (formData.get('default_country') as string) || '',
          max_results_per_run: parseInt((formData.get('max_results_per_run') as string) || '50'),
          scrape_delay_ms: parseInt((formData.get('scrape_delay_ms') as string) || '1200'),
          email_finder_enabled: (formData.get('email_finder_enabled') as string) === 'on',
          hunter_api_key: (formData.get('hunter_api_key') as string) || '',
          auto_send_enabled: (formData.get('auto_send_enabled') as string) === 'on',
          auto_send_cron: (formData.get('auto_send_cron') as string) || '',
          scraper_headful: (formData.get('scraper_headful') as string) === 'on',
          captcha_strategy: (formData.get('captcha_strategy') as string) || 'pause',
          two_captcha_key: (formData.get('two_captcha_key') as string) || '',
          captcha_timeout_s: parseInt((formData.get('captcha_timeout_s') as string) || '120'),
          smtp_host: (formData.get('smtp_host') as string) || '',
          smtp_port: parseInt((formData.get('smtp_port') as string) || '587'),
          smtp_secure: (formData.get('smtp_secure') as string) === 'on',
          smtp_username: (formData.get('smtp_username') as string) || '',
          smtp_password: (formData.get('smtp_password') as string) || '',
          smtp_from_name: (formData.get('smtp_from_name') as string) || '',
          smtp_from_email: (formData.get('smtp_from_email') as string) || '',
          discord_webhook_url: (formData.get('discord_webhook_url') as string) || '',
          imap_cron: (formData.get('imap_cron') as string) || '*/5 * * * *',
          warmup_cron: (formData.get('warmup_cron') as string) || '*/30 * * * *',
          use_ai_for_outreach: (formData.get('use_ai_for_outreach') as string) === 'on',
          default_email_template_id: formData.get('default_email_template_id') ? parseInt(formData.get('default_email_template_id') as string) : null
        })
      }}
    >
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Configure scraping and AI preferences</p>
      </div>

      <Card>
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Developer info</h3>
        <Input
          label="Your name (used in email drafts)"
          placeholder="e.g. Najam"
          defaultValue={settings.developer_name}
          name="developer_name"
        />
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Email Templates & AI</h3>
        
        <div className="space-y-4 mb-6 p-4 rounded-md border border-zinc-800 bg-zinc-900/30">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="use_ai_for_outreach"
              defaultChecked={settings.use_ai_for_outreach}
              name="use_ai_for_outreach"
              className="rounded border-zinc-600 bg-zinc-800 text-emerald-500"
            />
            <label htmlFor="use_ai_for_outreach" className="text-sm text-zinc-300">
              Use AI to dynamically draft every outreach email (Uses OpenRouter API)
            </label>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">
              Default Fallback Template
            </label>
            <select
              name="default_email_template_id"
              defaultValue={settings.default_email_template_id?.toString() || ''}
              className="w-full px-3 py-2 rounded-md text-sm bg-zinc-900 border border-zinc-800 text-zinc-100 outline-none focus:border-emerald-500/50"
            >
              <option value="">-- None (AI will fail if disabled) --</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">
              This template will be used if AI drafting is disabled, or if the AI API fails.
            </p>
          </div>
        </div>

        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Manage Templates</h4>
        <EmailTemplatesManager />
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-zinc-300 mb-4">API Keys</h3>
        <ApiKeySettings settings={settings} onSave={save} />
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Proxy</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="proxy_enabled"
              defaultChecked={settings.proxy_enabled}
              name="proxy_enabled"
              className="rounded border-zinc-600 bg-zinc-800 text-emerald-500"
            />
            <label htmlFor="proxy_enabled" className="text-sm text-zinc-400">
              Enable proxy
            </label>
          </div>
          <Input
            label="Proxy URL"
            placeholder="http://proxy.example.com:8080"
            defaultValue={settings.proxy_url}
            name="proxy_url"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Username" defaultValue={settings.proxy_username} name="proxy_username" />
            <Input
              label="Password"
              type="password"
              defaultValue={settings.proxy_password}
              name="proxy_password"
            />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Scraping defaults</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Default city" defaultValue={settings.default_city} name="default_city" />
          <Input
            label="Default country"
            defaultValue={settings.default_country}
            name="default_country"
          />
          <Input
            label="Max results per run"
            type="number"
            defaultValue={settings.max_results_per_run}
            name="max_results_per_run"
          />
          <Input
            label="Delay between requests (ms)"
            type="number"
            defaultValue={settings.scrape_delay_ms}
            name="scrape_delay_ms"
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Automation & Email Finder</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="email_finder_enabled"
                defaultChecked={settings.email_finder_enabled}
                name="email_finder_enabled"
                className="rounded border-zinc-600 bg-zinc-800 text-emerald-500"
              />
              <label htmlFor="email_finder_enabled" className="text-sm text-zinc-400">
                Enable Email Finder (Hunter.io + pattern guessing)
              </label>
            </div>
            <Input
              label="Hunter.io API Key"
              type="password"
              placeholder="Leave blank to only use pattern guessing"
              defaultValue={settings.hunter_api_key}
              name="hunter_api_key"
            />
          </div>

          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_send_enabled"
                defaultChecked={settings.auto_send_enabled}
                name="auto_send_enabled"
                className="rounded border-zinc-600 bg-zinc-800 text-emerald-500"
              />
              <label htmlFor="auto_send_enabled" className="text-sm text-zinc-400">
                Enable Auto-Scheduler (send queued emails in background)
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Sender Cron"
                placeholder="e.g. */15 * * * *"
                defaultValue={settings.auto_send_cron}
                name="auto_send_cron"
              />
              <Input
                label="IMAP Listener Cron"
                placeholder="e.g. */5 * * * *"
                defaultValue={settings.imap_cron}
                name="imap_cron"
              />
              <Input
                label="Account Warmup Cron"
                placeholder="e.g. */30 * * * *"
                defaultValue={settings.warmup_cron}
                name="warmup_cron"
              />
            </div>
            <p className="text-xs text-zinc-500">
              Requires app restart to apply changes to cron schedule.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Workflow Alerts (Discord)</h3>
        <div className="space-y-3">
          <Input
            label="Discord Webhook URL"
            type="url"
            placeholder="https://discord.com/api/webhooks/..."
            defaultValue={settings.discord_webhook_url}
            name="discord_webhook_url"
          />
          <p className="text-xs text-zinc-500">
            If provided, you will receive instant notifications when an AI triage returns an 'interested' or 'objection' intent from a prospect's reply.
          </p>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Advanced Scraper Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="scraper_headful"
              defaultChecked={settings.scraper_headful}
              name="scraper_headful"
              className="rounded border-zinc-600 bg-zinc-800 text-emerald-500"
            />
            <label htmlFor="scraper_headful" className="text-sm text-zinc-400">
              Run scraper in Headful mode (show browser window)
            </label>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1.5">
              CAPTCHA Strategy
            </label>
            <select
              defaultValue={settings.captcha_strategy}
              name="captcha_strategy"
              className="w-full px-3 py-2 rounded-md text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 outline-none focus:border-emerald-500"
            >
              <option value="pause">Pause and wait (manual solve)</option>
              <option value="2captcha">2Captcha auto-solve ($0.001/CAPTCHA)</option>
              <option value="rotate_proxy">Rotate proxy and retry</option>
            </select>
          </div>
          <Input
            label="2Captcha API key (for auto-solve)"
            type="password"
            placeholder="your 2captcha key"
            defaultValue={settings.two_captcha_key}
            name="two_captcha_key"
          />
          <Input
            label="Pause timeout (seconds)"
            type="number"
            defaultValue={settings.captcha_timeout_s}
            name="captcha_timeout_s"
          />
          <p className="text-xs text-zinc-500">
            If CAPTCHA appears during a scrape run, the active strategy is applied automatically.
          </p>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Autonomous pipeline</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-300">Enable nightly pipeline</p>
              <p className="text-xs text-zinc-500 mt-0.5">Scrape targets automatically on schedule</p>
            </div>
            <input
              type="checkbox"
              defaultChecked={settings.pipeline_enabled}
              onChange={async (e) => {
                await save({ pipeline_enabled: e.target.checked })
                await window.api.pipeline.restartRunner()
              }}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Scrape time (cron)" placeholder="0 2 * * *"
              defaultValue={settings.pipeline_scrape_cron}
              onBlur={async (e) => { await save({ pipeline_scrape_cron: e.target.value }); await window.api.pipeline.restartRunner() }} />
            <Input label="Digest time (cron)" placeholder="0 7 * * *"
              defaultValue={settings.pipeline_digest_cron}
              onBlur={async (e) => { await save({ pipeline_digest_cron: e.target.value }); await window.api.pipeline.restartRunner() }} />
          </div>
          <Input label="Digest recipient email" type="email"
            placeholder="you@email.com"
            defaultValue={settings.digest_recipient_email}
            onBlur={(e) => save({ digest_recipient_email: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Auto-approve score threshold (0 = off)"
              type="number" defaultValue={settings.auto_approve_threshold ?? 0}
              onBlur={(e) => save({ auto_approve_threshold: parseInt(e.target.value) })} />
            <div className="flex items-center gap-2 mt-5">
              <input type="checkbox" id="auto_seq"
                defaultChecked={settings.auto_sequence_on_approve}
                onChange={(e) => save({ auto_sequence_on_approve: e.target.checked })}
                className="rounded border-zinc-600 bg-zinc-800 text-emerald-500" />
              <label htmlFor="auto_seq" className="text-sm text-zinc-400">Auto-schedule sequences on approve</label>
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg px-4 py-3 text-xs text-zinc-400 space-y-1">
            <p className="font-medium text-zinc-300">Example fully autonomous setup</p>
            <p>• Scrape cron: <span className="font-mono text-zinc-300">0 2 * * *</span> — runs at 2am</p>
            <p>• Digest cron: <span className="font-mono text-zinc-300">0 7 * * *</span> — email at 7am</p>
            <p>• Auto-approve threshold: <span className="font-mono text-zinc-300">30</span> — approve all low-scoring sites</p>
            <p>• Auto-schedule sequences: <span className="font-mono text-zinc-300">on</span> — emails queued automatically</p>
            <p>Result: wake up, check digest, due emails already queued and ready to send.</p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Auto-Send Engine</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="auto_send_enabled"
              defaultChecked={settings.auto_send_enabled}
              name="auto_send_enabled"
              className="rounded border-zinc-600 bg-zinc-800 text-emerald-500"
            />
            <label htmlFor="auto_send_enabled" className="text-sm text-zinc-400">
              Enable Auto-Sender (background process)
            </label>
          </div>
          <Input
            label="Cron Schedule"
            placeholder="*/5 * * * *"
            defaultValue={settings.auto_send_cron}
            name="auto_send_cron"
          />
          <p className="text-xs text-zinc-500">
            Cron expression for checking due emails (default: every 5 minutes <code>*/5 * * * *</code>).
          </p>
        </div>
      </Card>

      <EmailAccountsManager />

      <div className="flex items-center gap-4">
        <button
          type="submit"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-colors"
        >
          Save Settings
        </button>
        {saving && <p className="text-xs text-emerald-400">Saving…</p>}
      </div>
    </form>
  )
}
