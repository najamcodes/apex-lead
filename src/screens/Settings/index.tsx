// src/screens/Settings/index.tsx
import { useEffect } from 'react'
import { useSettingsStore } from '../../store/settings.store'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { ApiKeySettings } from './ApiKeySettings'

export function Settings() {
  const { settings, loaded, saving, load, save } = useSettingsStore()

  useEffect(() => {
    load()
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
          smtp_from_email: (formData.get('smtp_from_email') as string) || ''
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
            <Input
              label="Cron Expression (When to run the scheduler)"
              placeholder="e.g. */15 * * * *"
              defaultValue={settings.auto_send_cron}
              name="auto_send_cron"
            />
            <p className="text-xs text-zinc-500">
              Requires app restart to apply changes to cron schedule.
            </p>
          </div>
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
        <h3 className="text-sm font-medium text-zinc-300 mb-4">SMTP (email sending)</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="SMTP Host"
              placeholder="smtp.gmail.com"
              defaultValue={settings.smtp_host}
              name="smtp_host"
            />
            <Input
              label="Port"
              type="number"
              placeholder="587"
              defaultValue={settings.smtp_port}
              name="smtp_port"
            />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="smtp_secure"
              defaultChecked={settings.smtp_secure}
              name="smtp_secure"
              className="rounded border-zinc-600 bg-zinc-800 text-emerald-500"
            />
            <label htmlFor="smtp_secure" className="text-sm text-zinc-400">
              Secure (SSL/TLS - Port 465)
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Username"
              placeholder="you@gmail.com"
              defaultValue={settings.smtp_username}
              name="smtp_username"
            />
            <Input
              label="Password"
              type="password"
              placeholder="App password"
              defaultValue={settings.smtp_password}
              name="smtp_password"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="From Name"
              placeholder="John Doe"
              defaultValue={settings.smtp_from_name}
              name="smtp_from_name"
            />
            <Input
              label="From Email"
              placeholder="john@example.com"
              defaultValue={settings.smtp_from_email}
              name="smtp_from_email"
            />
          </div>
          <button
            className="mt-2 text-xs text-blue-400 hover:underline"
            onClick={async () => {
              const res = await window.api.outreach.smtp.verify()
              if (res.ok) alert('SMTP connection successful!')
              else alert('SMTP Error: ' + res.error)
            }}
          >
            Verify SMTP Connection
          </button>
        </div>
      </Card>

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
