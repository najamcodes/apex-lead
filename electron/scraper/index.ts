// electron/scraper/index.ts
// Orchestrates a full scrape job: browser → scrape → filter → insert leads

import { randomUUID } from 'crypto'
import { createContext } from './stealth'
import { scrapeGoogleMaps } from './google-maps'
import { proxyManager } from './proxy-manager'
import { classifyWebsiteStatus } from './classify-website'
import { insertLead } from '../../src/db/queries/leads.queries'
import { insertScrapeJob, updateScrapeJob } from '../../src/db/queries/scrape-jobs.queries'
import { logActivity } from '../../src/db/queries/activity.queries'
import { analyzeBatch } from '../analysis'
import { getSettings } from '../../src/db/queries/settings.queries'
import type { ScrapeJobConfig, ScrapeProgressEvent } from '../../src/types/scraper.types'

type ProgressCallback = (event: ScrapeProgressEvent) => void

// Active jobs — keyed by job id
const activeJobs = new Map<string, { cancelled: boolean }>()

export async function startScrapeJob(
  config: ScrapeJobConfig,
  onProgress: ProgressCallback
): Promise<string> {
  const jobId = randomUUID()
  const cancelToken = { cancelled: false }
  activeJobs.set(jobId, cancelToken)

  // Persist job to DB
  insertScrapeJob({
    id: jobId,
    query: config.query,
    city: config.city,
    country: config.country,
    max_results: config.max_results,
    status: 'running',
  })

  updateScrapeJob(jobId, { started_at: new Date().toISOString(), status: 'running' })

  // Run async — don't await, fire and forget
  ;(async () => {
    let found = 0
    try {
      const proxy = config.use_proxy ? proxyManager.next() : null
      const context = await createContext(proxy)

      const listings = await scrapeGoogleMaps(
        context,
        config.query,
        config.city,
        config.max_results,
        (count, current) => {
          found = count
          onProgress({
            job_id: jobId,
            found: count,
            total: config.max_results,
            current_business: current,
            status: 'running',
          })
          updateScrapeJob(jobId, { found: count, progress: Math.round((count / config.max_results) * 100) })
        },
        cancelToken
      )

      await context.close()

      // Insert leads into DB
      const insertedIds = listings
        .map((listing) => {
          if (cancelToken.cancelled) return null
          try {
            const inserted = insertLead({
              business_name: listing.business_name,
              category: listing.category,
              city: listing.city,
              country: config.country,
              phone: listing.phone ?? undefined,
              website_url: listing.website_url ?? undefined,
              google_maps_url: listing.google_maps_url ?? undefined,
              source: 'google_maps',
              website_status: classifyWebsiteStatus(listing.website_url),
            })
            if (inserted?.id) {
              logActivity(inserted.id, 'lead_scraped', `Source: google_maps, city: ${config.city}`)
              return inserted.id
            }
            return null
          } catch {
            return null
          }
        })
        .filter((id): id is number => id !== null)

      const finalStatus = cancelToken.cancelled ? 'cancelled' : 'completed'
      updateScrapeJob(jobId, {
        status: finalStatus,
        found,
        progress: 100,
        completed_at: new Date().toISOString(),
      })

      onProgress({
        job_id: jobId,
        found,
        total: config.max_results,
        current_business: '',
        status: finalStatus,
      })

      // Auto-analyze if AI is enabled
      const settings = getSettings()
      if (settings.ai_enabled && insertedIds.length > 0) {
        analyzeBatch(insertedIds, (done, total) => {
          onProgress({
            job_id: jobId,
            found: done,
            total,
            current_business: `Analyzing ${done}/${total}…`,
            status: 'running',
          })
        }).catch(() => {}) // non-blocking
      }
    } catch (err) {
      updateScrapeJob(jobId, {
        status: 'failed',
        error_message: String(err),
        completed_at: new Date().toISOString(),
      })
      onProgress({
        job_id: jobId,
        found,
        total: config.max_results,
        current_business: '',
        status: 'failed',
        error: String(err),
      })
    } finally {
      activeJobs.delete(jobId)
    }
  })()

  return jobId
}

export function cancelScrapeJob(jobId: string): void {
  const token = activeJobs.get(jobId)
  if (token) {
    token.cancelled = true
    updateScrapeJob(jobId, { status: 'cancelled', completed_at: new Date().toISOString() })
  }
}
