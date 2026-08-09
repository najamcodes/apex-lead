// plugins/registry.ts
// Discovers, loads, and validates plugins from built-in/ and user/ directories.
// Maintains three typed Maps that runner.ts consults at hook points.

import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { z } from 'zod'
import type {
  Plugin,
  PluginRecord,
  PluginManifest,
  ConnectorPlugin,
  PluginTrigger,
} from './types'

// ─────────────────────────────────────────────────────────────────
// Manifest schema (validated at load time)
// ─────────────────────────────────────────────────────────────────

const ManifestSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'id must be lowercase kebab-case'),
  kind: z.enum(['scraper', 'enricher', 'connector']),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'must be semver'),
  description: z.string(),
  author: z.string(),
  main: z.string().default('index.ts'),
  enabledByDefault: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
})

// ─────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────

const _scrapers  = new Map<string, PluginRecord>()
const _enrichers = new Map<string, PluginRecord>()
const _connectors = new Map<string, PluginRecord>()

let _initialized = false

// Per-org plugin config cache — keyed as `${orgId}:${pluginId}`
const _configCache = new Map<string, { enabled: boolean; config: Record<string, unknown> }>()

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function pluginsRoot(): string {
  return resolve(__dirname, '..')  // plugins/ is one level above this file
}

function getPluginDirs(subdir: 'built-in' | 'user'): string[] {
  const dir = join(pluginsRoot(), subdir)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => join(dir, d.name))
}

function readManifest(pluginDir: string): PluginManifest | null {
  const manifestPath = join(pluginDir, 'plugin.json')
  if (!existsSync(manifestPath)) return null
  try {
    const raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const parsed = ManifestSchema.safeParse(raw)
    if (!parsed.success) {
      console.warn(`[plugins] Invalid manifest at ${manifestPath}:`, parsed.error.flatten().fieldErrors)
      return null
    }
    return parsed.data as PluginManifest
  } catch (err) {
    console.warn(`[plugins] Failed to parse manifest at ${manifestPath}:`, err)
    return null
  }
}

async function loadDbConfig(pluginId: string, orgId: number): Promise<{ enabled: boolean; config: Record<string, unknown> }> {
  const cacheKey = `${orgId}:${pluginId}`
  if (_configCache.has(cacheKey)) return _configCache.get(cacheKey)!

  try {
    // Lazy-import to avoid circular dependency; DB may not be ready at module load
    const { getDataSource } = require('../backend/db') as typeof import('../backend/db')
    const ds = getDataSource()
    if (!ds.isInitialized) return { enabled: false, config: {} }

    const rows = (await ds.createQueryBuilder()
      .select(['enabled', 'config'])
      .from('plugin_settings', 'ps')
      .where('ps.plugin_id = :id AND ps.org_id = :orgId', { id: pluginId, orgId })
      .getRawOne()) as unknown as { enabled: 0 | 1; config: string | null } | undefined

    if (!rows) return { enabled: false, config: {} }

    const entry = {
      enabled: Boolean(rows.enabled),
      config: rows.config ? JSON.parse(rows.config) : {},
    }
    _configCache.set(cacheKey, entry)
    return entry
  } catch {
    return { enabled: false, config: {} }
  }
}

async function registerPlugin(
  manifest: PluginManifest,
  plugin: Plugin,
  dir: string,
  source: 'built-in' | 'user',
) {
  // For built-in plugins, enable by default without a DB row
  const orgId = (global as any).currentOrgId ?? 0
  const dbConfig = await loadDbConfig(manifest.id, orgId)
  const enabled = source === 'built-in' && manifest.enabledByDefault
    ? (dbConfig.enabled ?? true)
    : dbConfig.enabled

  const record: PluginRecord = {
    manifest,
    plugin,
    enabled,
    config: dbConfig.config,
    dir,
    source,
  }

  if (manifest.kind === 'scraper')   _scrapers.set(manifest.id, record)
  if (manifest.kind === 'enricher')  _enrichers.set(manifest.id, record)
  if (manifest.kind === 'connector') _connectors.set(manifest.id, record)

  console.log(`[plugins] Loaded ${source} ${manifest.kind}: ${manifest.id} v${manifest.version} (enabled=${enabled})`)
}

async function loadPlugin(pluginDir: string, source: 'built-in' | 'user'): Promise<void> {
  const manifest = readManifest(pluginDir)
  if (!manifest) return

  const entryPath = join(pluginDir, manifest.main)
  if (!existsSync(entryPath)) {
    console.warn(`[plugins] Entry file not found: ${entryPath}`)
    return
  }

  try {
    const mod = await import(entryPath) as { default?: Plugin } & Record<string, unknown>
    const plugin = (mod.default ?? mod.plugin ?? mod) as Plugin

    if (!plugin || typeof plugin !== 'object' || !('kind' in plugin)) {
      console.warn(`[plugins] ${manifest.id}: export must be a Plugin object with a 'kind' field`)
      return
    }
    if (plugin.kind !== manifest.kind) {
      console.warn(`[plugins] ${manifest.id}: manifest.kind '${manifest.kind}' ≠ plugin.kind '${plugin.kind}'`)
      return
    }

    registerPlugin(manifest, plugin, pluginDir, source)
  } catch (err) {
    console.error(`[plugins] Failed to load ${manifest.id}:`, err)
    // Still register with an error state so the UI can show it
    const record: PluginRecord = {
      manifest,
      plugin: null as any,
      enabled: false,
      config: {},
      dir: pluginDir,
      source,
      loadError: String(err),
    }
    if (manifest.kind === 'scraper')   _scrapers.set(manifest.id, record)
    if (manifest.kind === 'enricher')  _enrichers.set(manifest.id, record)
    if (manifest.kind === 'connector') _connectors.set(manifest.id, record)
  }
}

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/** Load all plugins. Call once at server/Electron startup after DB init. */
export async function initPluginRegistry(): Promise<void> {
  if (_initialized) return
  _initialized = true

  const dirs: Array<[string, 'built-in' | 'user']> = [
    ...getPluginDirs('built-in').map(d => [d, 'built-in'] as [string, 'built-in' | 'user']),
    ...getPluginDirs('user').map(d => [d, 'user'] as [string, 'user']),
  ]

  await Promise.allSettled(dirs.map(([dir, src]) => loadPlugin(dir, src)))
  console.log(`[plugins] Registry ready — scrapers:${_scrapers.size} enrichers:${_enrichers.size} connectors:${_connectors.size}`)
}

/** All registered scraper plugins (enabled and disabled). */
export function getAllPlugins(): PluginRecord[] {
  return [
    ..._scrapers.values(),
    ..._enrichers.values(),
    ..._connectors.values(),
  ]
}

/** Enabled scraper plugins. */
export function getEnabledScrapers(): PluginRecord[] {
  return [..._scrapers.values()].filter(r => r.enabled && !r.loadError)
}

/** Enabled enricher plugins. */
export function getEnabledEnrichers(): PluginRecord[] {
  return [..._enrichers.values()].filter(r => r.enabled && !r.loadError)
}

/** Enabled connector plugins subscribed to the given trigger. */
export function getEnabledConnectors(trigger: PluginTrigger): PluginRecord[] {
  return [..._connectors.values()].filter(r => {
    if (!r.enabled || r.loadError) return false
    return (r.plugin as ConnectorPlugin).on.includes(trigger)
  })
}

/** Get a single plugin record by id. */
export function getPlugin(id: string): PluginRecord | undefined {
  return _scrapers.get(id) ?? _enrichers.get(id) ?? _connectors.get(id)
}

/** Enable or disable a plugin and persist the setting. */
export async function setPluginEnabled(id: string, enabled: boolean, orgId: number): Promise<void> {
  const record = getPlugin(id)
  if (!record) throw new Error(`Plugin '${id}' not found`)
  record.enabled = enabled

  // Invalidate cache
  _configCache.delete(`${orgId}:${id}`)

  const { getDataSource } = require('../backend/db') as typeof import('../backend/db')
  const ds = getDataSource()
  await ds.createQueryBuilder()
    .insert()
    .into('plugin_settings')
    .values({ plugin_id: id, org_id: orgId, enabled: enabled ? 1 : 0, config: JSON.stringify(record.config), updated_at: new Date().toISOString() })
    .orUpdate(['enabled', 'updated_at'], ['plugin_id', 'org_id'])
    .execute()
}

/** Update plugin config and persist it. */
export async function setPluginConfig(id: string, config: Record<string, unknown>, orgId: number): Promise<void> {
  const record = getPlugin(id)
  if (!record) throw new Error(`Plugin '${id}' not found`)

  // Validate against the plugin's own schema
  const parsed = record.plugin.configSchema.safeParse(config)
  if (!parsed.success) {
    throw new Error(`Invalid config for plugin '${id}': ${JSON.stringify(parsed.error.flatten().fieldErrors)}`)
  }

  record.config = parsed.data as Record<string, unknown>
  _configCache.delete(`${orgId}:${id}`)

  const { getDataSource } = require('../backend/db') as typeof import('../backend/db')
  const ds = getDataSource()
  await ds.createQueryBuilder()
    .insert()
    .into('plugin_settings')
    .values({ plugin_id: id, org_id: orgId, enabled: record.enabled ? 1 : 0, config: JSON.stringify(record.config), updated_at: new Date().toISOString() })
    .orUpdate(['config', 'updated_at'], ['plugin_id', 'org_id'])
    .execute()
}
