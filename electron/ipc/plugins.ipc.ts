// electron/ipc/plugins.ipc.ts
// IPC handlers that give the Electron renderer access to the plugin system.
// Mirrors the /api/plugins REST endpoints so plugin management works in
// both the desktop app (via IPC) and the web app (via the Hono server).

import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import {
  getAllPlugins,
  getPlugin,
  setPluginEnabled,
  setPluginConfig,
} from '../../plugins/registry'
import { getTenantId } from '../../backend/db/queries/tenant'
import type { ConnectorPlugin, LeadSnapshot } from '../../plugins/types'

export function registerPluginIpcHandlers(): void {
  // ── List all plugins ─────────────────────────────────────────────
  ipcMain.handle(IPC.PLUGINS_GET_ALL, () => {
    return getAllPlugins().map(r => ({
      id:          r.manifest.id,
      kind:        r.manifest.kind,
      name:        r.manifest.name,
      version:     r.manifest.version,
      description: r.manifest.description,
      author:      r.manifest.author,
      tags:        r.manifest.tags ?? [],
      source:      r.source,
      enabled:     r.enabled,
      loadError:   r.loadError ?? null,
    }))
  })

  // ── Get single plugin ─────────────────────────────────────────────
  ipcMain.handle(IPC.PLUGINS_GET, (_event, id: string) => {
    const record = getPlugin(id)
    if (!record) return null
    return {
      id:          record.manifest.id,
      kind:        record.manifest.kind,
      name:        record.manifest.name,
      version:     record.manifest.version,
      description: record.manifest.description,
      author:      record.manifest.author,
      tags:        record.manifest.tags ?? [],
      source:      record.source,
      enabled:     record.enabled,
      config:      record.config,
      loadError:   record.loadError ?? null,
    }
  })

  // ── Enable / disable a plugin ─────────────────────────────────────
  ipcMain.handle(IPC.PLUGINS_TOGGLE, async (_event, id: string, enabled: boolean) => {
    await setPluginEnabled(id, enabled, getTenantId())
    return { success: true, enabled }
  })

  // ── Update plugin config ──────────────────────────────────────────
  ipcMain.handle(IPC.PLUGINS_SET_CONFIG, async (_event, id: string, config: Record<string, unknown>) => {
    await setPluginConfig(id, config, getTenantId())
    return { success: true }
  })

  // ── Test connector plugin ─────────────────────────────────────────
  ipcMain.handle(IPC.PLUGINS_TEST, async (_event, id: string) => {
    const record = getPlugin(id)
    if (!record) return { success: false, error: 'Plugin not found' }
    if (record.manifest.kind !== 'connector') {
      return { success: false, error: 'Only connector plugins support connectivity tests' }
    }

    const plugin = record.plugin as ConnectorPlugin
    const dummyLead: LeadSnapshot = {
      id: 0, org_id: getTenantId(),
      business_name: 'Test Business', category: 'Test',
      city: 'Test City', country: 'US',
      phone: null, email: null, website_url: null, google_maps_url: null,
      website_status: null, ssl_valid: null, tech_stack: null, social_links: null,
      review_rating: null, review_count: null, ai_site_score: null,
      status: 'scraped', source: 'test',
      scraped_at: new Date().toISOString(),
    }

    try {
      await plugin.push(
        { trigger: 'lead.created', org_id: getTenantId(), lead: dummyLead, metadata: { test: true } },
        record.config,
      )
      return { success: true, message: 'Test event sent successfully' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
