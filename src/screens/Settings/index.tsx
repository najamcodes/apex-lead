// src/screens/Settings/index.tsx
import { useEffect } from 'react'
import { useSettingsStore } from '../../store/settings.store'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { ApiKeySettings } from './ApiKeySettings'

export function Settings() {
  const { settings, loaded, saving, load, save } = useSettingsStore()

  useEffect(() => { load() }, [])
  if (!loaded || !settings) return null

  return (
    <div className="space-y-6 max-w-2xl">
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
          onBlur={(e) => save({ developer_name: e.target.value })}
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
              onChange={(e) => save({ proxy_enabled: e.target.checked })}
              className="rounded border-zinc-600 bg-zinc-800 text-emerald-500"
            />
            <label htmlFor="proxy_enabled" className="text-sm text-zinc-400">Enable proxy</label>
          </div>
          <Input
            label="Proxy URL"
            placeholder="http://proxy.example.com:8080"
            defaultValue={settings.proxy_url}
            onBlur={(e) => save({ proxy_url: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Username"
              defaultValue={settings.proxy_username}
              onBlur={(e) => save({ proxy_username: e.target.value })}
            />
            <Input
              label="Password"
              type="password"
              defaultValue={settings.proxy_password}
              onBlur={(e) => save({ proxy_password: e.target.value })}
            />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Scraping defaults</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Default city"
            defaultValue={settings.default_city}
            onBlur={(e) => save({ default_city: e.target.value })}
          />
          <Input
            label="Default country"
            defaultValue={settings.default_country}
            onBlur={(e) => save({ default_country: e.target.value })}
          />
          <Input
            label="Max results per run"
            type="number"
            defaultValue={settings.max_results_per_run}
            onBlur={(e) => save({ max_results_per_run: parseInt(e.target.value) })}
          />
          <Input
            label="Delay between requests (ms)"
            type="number"
            defaultValue={settings.scrape_delay_ms}
            onBlur={(e) => save({ scrape_delay_ms: parseInt(e.target.value) })}
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
                onChange={(e) => save({ email_finder_enabled: e.target.checked })}
                className="rounded border-zinc-600 bg-zinc-800 text-emerald-500"
              />
              <label htmlFor="email_finder_enabled" className="text-sm text-zinc-400">Enable Email Finder (Hunter.io + pattern guessing)</label>
            </div>
            <Input
              label="Hunter.io API Key"
              type="password"
              placeholder="Leave blank to only use pattern guessing"
              defaultValue={settings.hunter_api_key}
              onBlur={(e) => save({ hunter_api_key: e.target.value })}
            />
          </div>

          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_send_enabled"
                defaultChecked={settings.auto_send_enabled}
                onChange={(e) => save({ auto_send_enabled: e.target.checked })}
                className="rounded border-zinc-600 bg-zinc-800 text-emerald-500"
              />
              <label htmlFor="auto_send_enabled" className="text-sm text-zinc-400">Enable Auto-Scheduler (send queued emails in background)</label>
            </div>
            <Input
              label="Cron Expression (When to run the scheduler)"
              placeholder="e.g. */15 * * * *"
              defaultValue={settings.auto_send_cron}
              onBlur={(e) => save({ auto_send_cron: e.target.value })}
            />
            <p className="text-xs text-zinc-500">Requires app restart to apply changes to cron schedule.</p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-zinc-300 mb-4">SMTP (email sending)</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="SMTP Host" placeholder="smtp.gmail.com"
              defaultValue={settings.smtp_host}
              onBlur={(e) => save({ smtp_host: e.target.value })} />
            <Input label="Port" type="number" placeholder="587"
              defaultValue={settings.smtp_port}
              onBlur={(e) => save({ smtp_port: parseInt(e.target.value) })} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input type="checkbox" id="smtp_secure"
              defaultChecked={settings.smtp_secure}
              onChange={(e) => save({ smtp_secure: e.target.checked })}
              className="rounded border-zinc-600 bg-zinc-800 text-emerald-500" />
            <label htmlFor="smtp_secure" className="text-sm text-zinc-400">Secure (SSL/TLS - Port 465)</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Username" placeholder="you@gmail.com"
              defaultValue={settings.smtp_username}
              onBlur={(e) => save({ smtp_username: e.target.value })} />
            <Input label="Password" type="password" placeholder="App password"
              defaultValue={settings.smtp_password}
              onBlur={(e) => save({ smtp_password: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="From Name" placeholder="John Doe"
              defaultValue={settings.smtp_from_name}
              onBlur={(e) => save({ smtp_from_name: e.target.value })} />
            <Input label="From Email" placeholder="john@example.com"
              defaultValue={settings.smtp_from_email}
              onBlur={(e) => save({ smtp_from_email: e.target.value })} />
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

      {saving && (
        <p className="text-xs text-emerald-400">Saving…</p>
      )}
    </div>
  )
}
