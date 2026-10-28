import type { RequestContext } from 'katal'
import { getTenantId } from '../../db/queries/tenant'
import { getAllPlugins, getPlugin, setPluginEnabled, setPluginConfig } from '@sdk/plugins/registry'
import { sendError, HttpStatus } from '../../common'

export class PluginController {
  /**
   * GET /api/plugins — List all plugins
   */
  static async list(c: RequestContext): Promise<Response> {
    try {
      const plugins = getAllPlugins().map((r) => ({
        id: r.manifest.id,
        kind: r.manifest.kind,
        name: r.manifest.name,
        version: r.manifest.version,
        description: r.manifest.description,
        author: r.manifest.author,
        tags: r.manifest.tags ?? [],
        source: r.source,
        enabled: r.enabled,
        loadError: r.loadError ?? null,
      }))
      return c.json(plugins)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/plugins/:id — Get details of a single plugin
   */
  static async getById(c: RequestContext): Promise<Response> {
    try {
      const id = (c.params?.id || c.req.param('id') || '') as string
      const record = getPlugin(id)
      if (!record) return c.json({ error: 'Plugin not found' }, 404)
      return c.json({
        id: record.manifest.id,
        kind: record.manifest.kind,
        name: record.manifest.name,
        version: record.manifest.version,
        description: record.manifest.description,
        author: record.manifest.author,
        tags: record.manifest.tags ?? [],
        source: record.source,
        enabled: record.enabled,
        config: record.config,
        loadError: record.loadError ?? null,
      })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * PATCH /api/plugins/:id/toggle — Enable or disable a plugin
   */
  static async toggle(c: RequestContext): Promise<Response> {
    try {
      const id = (c.params?.id || c.req.param('id') || '') as string
      const { enabled } = await c.req.json()
      await setPluginEnabled(id, enabled, getTenantId())
      return c.json({ success: true, enabled })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 404)
    }
  }

  /**
   * PUT /api/plugins/:id/config — Update plugin config
   */
  static async updateConfig(c: RequestContext): Promise<Response> {
    try {
      const id = (c.params?.id || c.req.param('id') || '') as string
      const config = await c.req.json()
      await setPluginConfig(id, config as Record<string, unknown>, getTenantId())
      return c.json({ success: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      const status = message.includes('not found') ? 404 : 400
      return c.json({ error: message }, status)
    }
  }

  /**
   * POST /api/plugins/:id/test — Run connector plugin test
   */
  static async test(c: RequestContext): Promise<Response> {
    try {
      const id = (c.params?.id || c.req.param('id') || '') as string
      const record = getPlugin(id)
      if (!record) return c.json({ error: 'Plugin not found' }, 404)
      if (record.manifest.kind !== 'connector') {
        return c.json({ error: 'Only connector plugins support connectivity tests' }, 422)
      }

      const plugin = record.plugin as import('@sdk/plugins/types.js').ConnectorPlugin
      const dummyLead: import('@sdk/plugins/types.js').LeadSnapshot = {
        id: 0,
        org_id: getTenantId(),
        business_name: 'Test Business',
        category: 'Test',
        city: 'Test City',
        country: 'US',
        phone: null,
        email: null,
        website_url: null,
        google_maps_url: null,
        website_status: null,
        ssl_valid: null,
        tech_stack: null,
        social_links: null,
        review_rating: null,
        review_count: null,
        ai_site_score: null,
        status: 'scraped',
        source: 'test',
        scraped_at: new Date().toISOString(),
      }

      await plugin.push(
        { trigger: 'lead.created', org_id: getTenantId(), lead: dummyLead, metadata: { test: true } },
        record.config
      )
      return c.json({ success: true, message: 'Test event sent successfully' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ success: false, error: message })
    }
  }
}
