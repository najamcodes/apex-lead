// electron/pipeline/index.ts
// Runs all active scrape targets and collects results for the digest.

import { getActiveTargets, markTargetRun } from '../../backend/db/queries/targets.queries'
import { getSettings } from '../../backend/db/queries/settings.queries'
import { getDataSource } from '../../backend/db'
import { startPipelineJob } from '../../backend/core/pipelines'
import { logActivity } from '../../backend/db/queries/activity.queries'
import { getActiveQueryProfiles, incrementQueryProfileGenerated } from '../../backend/db/queries/query-profiles.queries'
import { generateQueriesFromProfile } from '../../backend/core/ai/tasks/generate-queries'
import type { ScrapeTarget } from '../../shared/types/pipeline.types'

export interface PipelineRunResult {
  targets_run:      number
  total_scraped:    number
  total_qualified:  number
  total_no_website: number
  total_new:        number
  top_leads:        any[]
  errors:           string[]
}

// Track current pipeline state for status IPC
let _running  = false
let _progress = { current: '', done: 0, total: 0 }

export function getPipelineStatus() {
  return { running: _running, progress: _progress }
}

export async function runNightlyPipeline(
  onProgress?: (msg: string) => void
): Promise<PipelineRunResult> {
  if (_running) {
    throw new Error('Pipeline already running')
  }

  _running  = true
  _progress = { current: 'Starting...', done: 0, total: 0 }

  const log = (msg: string) => {
    console.log(`[Pipeline] ${msg}`)
    onProgress?.(msg)
    _progress.current = msg
  }

  const result: PipelineRunResult = {
    targets_run:      0,
    total_scraped:    0,
    total_qualified:  0,
    total_no_website: 0,
    total_new:        0,
    top_leads:        [],
    errors:           [],
  }

  try {
    const targets  = await getActiveTargets()

    if (targets.length === 0) {
      log('No active targets configured. Add targets in the Pipeline screen.')
      return result
    }

    const settings = await getSettings()
    
    // 1. Process Query Profiles
    const profiles = await getActiveQueryProfiles()
    if (profiles.length > 0 && settings.ai_enabled ) {
      log(`Expanding ${profiles.length} Smart Query Profiles via AI...`)
      for (const profile of profiles) {
        try {
          const queries = await generateQueriesFromProfile(settings, profile, settings.ai_model_site_scoring)
          for (const q of queries) {
            targets.push({
              id: -1,
              label: `[Smart] ${q.query}`,
              query: q.query,
              city: q.city,
              country: JSON.parse(profile.countries)[0] || 'United States',
              max_per_run: 15,
              min_ai_score: 0,
              website_filter: 'all',
              status: 'active',
              use_proxy: false,
              last_run_at: null,
              next_run_at: null,
              total_found: 0,
              created_at: new Date().toISOString()
            })
          }
          await incrementQueryProfileGenerated(profile.id, queries.length)
        } catch (err) {
          log(`Failed to generate queries for profile ${profile.label}: ${String(err)}`)
        }
      }
    }

    log(`Running ${targets.length} active target(s) / queries...`)
    _progress.total = targets.length

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]
      log(`[${i + 1}/${targets.length}] Scraping: ${target.label}`)
      _progress.done = i

      try {
        const newLeadIds = await runSingleTarget(target, log)

        result.targets_run++
        result.total_new     += newLeadIds.length
        result.total_scraped += newLeadIds.length

        // Count no-website leads
        const db = getDataSource()
          if (newLeadIds.length > 0) {
            const noWebsiteCount = await db.createQueryBuilder()
              .select('COUNT(*)', 'count')
              .from('leads', 'leads')
              .where('id IN (:...ids)', { ids: newLeadIds })
              .andWhere('website_status = :status', { status: 'none' })
              .getRawOne()
            result.total_no_website += Number(noWebsiteCount?.count ?? 0)
          }

        if (target.id !== -1) {
          await markTargetRun(target.id, newLeadIds.length)
        }
        log(`✓ ${target.label}: ${newLeadIds.length} new leads`)

        // Gap between targets
        await new Promise((r) => setTimeout(r, 5000))
      } catch (err) {
        const msg = `✗ ${target.label} failed: ${String(err)}`
        log(msg)
        result.errors.push(msg)
      }
    }

    // Get top leads for digest (best AI scores, no website prioritized)
    result.top_leads = await getTopLeadsForDigest(10)
    result.total_qualified = result.top_leads.length

    // Auto-schedule sequences for auto-approved leads with emails
    if (settings.auto_sequence_on_approve) {
      await autoScheduleSequences(log)
    }

    log(`Pipeline complete. ${result.total_new} new leads across ${result.targets_run} targets.`)
  } catch (err) {
    result.errors.push(String(err))
    console.error('[Pipeline] Fatal error:', err)
  } finally {
    _running  = false
    _progress = { current: '', done: 0, total: 0 }
  }

  return result
}

// ─── Run a single target ──────────────────────────────────────────────────────

async function runSingleTarget(
  target: ScrapeTarget,
  log: (msg: string) => void
): Promise<number[]> {
  return new Promise((resolve, reject) => {
    let completed = false

    const timeout = setTimeout(() => {
      if (!completed) reject(new Error('Target timed out after 10 minutes'))
    }, 10 * 60 * 1000)

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    startPipelineJob('lead-generation', 
      {
        query:       target.query,
        city:        target.city,
        country:     target.country,
        max_results: target.max_per_run,
        use_proxy:   target.use_proxy, stages: { scrape: true, analyze: true, outreach: true },
      },
      (event) => {
        if (event.status !== 'completed' && event.status !== 'failed' && event.status !== 'cancelled') {
           log(`  ${target.query} in ${target.city}: ${event.found} found — ${event.current_business}`)
        }

        if (event.status === 'completed' || event.status === 'failed' || event.status === 'cancelled') {
          completed = true
          clearTimeout(timeout)

          if (event.status === 'failed') {
            reject(new Error(event.error ?? 'Scrape failed'))
          } else {
            // Get IDs of leads inserted in this run
            // Get IDs of leads inserted in this run
            getDataSource().createQueryBuilder()
              .select('id')
              .from('leads', 'leads')
              .where('source = :source', { source: 'google_maps' })
              .andWhere('scraped_at >= :fifteenMinutesAgo', { fifteenMinutesAgo })
              .andWhere('city = :city', { city: target.city })
              .orderBy('id', 'DESC')
              .limit(target.max_per_run)
              .getRawMany()
              .then((rows) => {
              resolve(rows.map((r: any) => r.id))
            }).catch(reject)
          }
        }
      }
    ).catch(reject)
  })
}

// ─── Get top leads for digest ─────────────────────────────────────────────────

async function getTopLeadsForDigest(limit: number): Promise<any[]> {
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  return await getDataSource().createQueryBuilder()
    .select(['business_name', 'city', 'category', 'ai_site_score', 'website_status', 'phone', 'website_url'])
    .from('leads', 'leads')
    .where("scraped_at >= :twelveHoursAgo", { twelveHoursAgo })
    .andWhere("status NOT IN ('skipped', 'closed', 'unsubscribed')")
    .orderBy("CASE WHEN website_status = 'none' THEN 0 ELSE 1 END", 'ASC')
    .addOrderBy("COALESCE(ai_site_score, 0)", 'ASC')
    .addOrderBy("scraped_at", 'DESC')
    .limit(limit)
    .getRawMany()
}


