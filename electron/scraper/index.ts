// electron/scraper/index.ts
// Updated to use new stealth context factory

import { randomUUID as uuid } from 'crypto'
import { createStealthContext } from './stealth'
import { scrapeGoogleMaps } from './google-maps'
import { insertLead } from '../../src/db/queries/leads.queries'
import { insertScrapeJob, updateScrapeJob } from '../../src/db/queries/scrape-jobs.queries'
import { analyzeBatch } from '../analysis'
import { getSettings } from '../../src/db/queries/settings.queries'
import { classifyWebsiteStatus } from './classify-website'
import type { ScrapeJobConfig, ScrapeProgressEvent } from '../../src/types/scraper.types'

type ProgressCallback = (event: ScrapeProgressEvent) => void

export interface ScrapeControlToken {
  cancelled: boolean
  paused: boolean
}

const activeJobs = new Map<string, ScrapeControlToken>()

export async function checkPause(token: ScrapeControlToken) {
  while (token.paused && !token.cancelled) {
    await new Promise(r => setTimeout(r, 1000))
  }
}

export async function startScrapeJob(
  config: ScrapeJobConfig,
  onProgress: ProgressCallback
): Promise<string> {
  const jobId = uuid()
  const cancelToken: ScrapeControlToken = { cancelled: false, paused: false }
  activeJobs.set(jobId, cancelToken)

  insertScrapeJob({
    id:          jobId,
    query:       config.query,
    city:        config.city,
    country:     config.country,
    max_results: config.max_results,
    status:      'running',
  })

  updateScrapeJob(jobId, {
    started_at: new Date().toISOString(),
    status:     'running',
  })

  ;(async () => {
    let found = 0

    try {
      const settings = await getSettings()
      let proxyConfig: import('./stealth').ProxyConfig | null = null

      if (settings.proxy_enabled && settings.proxy_url) {
        proxyConfig = {
          server: settings.proxy_url,
          username: settings.proxy_username || undefined,
          password: settings.proxy_password || undefined,
        }
        console.log(`[Job] Using global proxy: ${proxyConfig.server}`)
      }

      const { context } = await createStealthContext(proxyConfig, !settings.scraper_headful)

      // Run the scraper
      const listings = await scrapeGoogleMaps(
        context,
        config.query,
        config.city,
        config.max_results,
        (count, current) => {
          found = count
          onProgress({
            job_id:           jobId,
            found:            count,
            total:            config.max_results,
            current_business: current,
            status:           'running',
          })
          updateScrapeJob(jobId, {
            found,
            progress: Math.round((count / config.max_results) * 100),
          })
        },
        cancelToken
      )

      await context.close().catch(() => {})

      // Insert leads into DB
      const insertedIds: number[] = []

      for (const listing of listings) {
        if (cancelToken.cancelled) break

        // Apply user-defined filters
        if (config.website_filter === 'required' && !listing.website_url) continue
        if (config.website_filter === 'none' && listing.website_url) continue
        if (config.phone_filter === 'required' && !listing.phone) continue
        if (config.phone_filter === 'none' && listing.phone) continue
        if (config.email_filter === 'required' && !listing.email) continue
        if (config.email_filter === 'none' && listing.email) continue

        try {
          const websiteStatus = listing.website_status ?? classifyWebsiteStatus(listing.website_url)
          const inserted = await insertLead({
            business_name:   listing.business_name,
            category:        listing.category || '',
            city:            listing.city || '',
            country:         config.country,
            phone:           listing.phone    ?? null,
            website_url:     listing.website_url ?? null,
            google_maps_url: listing.google_maps_url ?? null,
            email:           null,
            website_status:  websiteStatus as any,
            ssl_valid:       listing.ssl_valid ?? null,
            tech_stack:      listing.tech_stack ?? null,
            source:          'google_maps',
            review_rating:   listing.rating ?? null,
            review_count:    listing.review_count ?? null,
          })
          if (inserted?.id) insertedIds.push(inserted.id)
        } catch { /* duplicate or insert error — skip */ }
      }

      // Auto-trigger analysis pipeline if AI is enabled
      if (settings.ai_enabled && insertedIds.length > 0) {
        onProgress({
          job_id:           jobId,
          found:            insertedIds.length,
          total:            insertedIds.length,
          current_business: `Analyzing ${insertedIds.length} leads…`,
          status:           'running',
        })

        analyzeBatch(insertedIds, (done, total) => {
          onProgress({
            job_id:           jobId,
            found:            done,
            total,
            current_business: `Analyzing ${done}/${total}…`,
            status:           'running',
          })
        }).catch(() => {}) // non-blocking
      }

      const finalStatus = cancelToken.cancelled ? 'cancelled' : 'completed'

      updateScrapeJob(jobId, {
        status:       finalStatus,
        found:        insertedIds.length,
        progress:     100,
        completed_at: new Date().toISOString(),
      })

      onProgress({
        job_id:           jobId,
        found:            insertedIds.length,
        total:            config.max_results,
        current_business: '',
        status:           finalStatus,
      })
    } catch (err) {
      console.error('[Scraper] Job failed:', err)
      updateScrapeJob(jobId, {
        status:        'failed',
        error_message: String(err),
        completed_at:  new Date().toISOString(),
      })
      onProgress({
        job_id:           jobId,
        found,
        total:            config.max_results,
        current_business: '',
        status:           'failed',
        error:            String(err),
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
    updateScrapeJob(jobId, {
      status:       'cancelled',
      completed_at: new Date().toISOString(),
    })
  }
}

export function pauseScrapeJob(jobId: string): void {
  const token = activeJobs.get(jobId)
  if (token) {
    token.paused = true
    updateScrapeJob(jobId, { status: 'paused' })
  }
}

export function resumeScrapeJob(jobId: string): void {
  const token = activeJobs.get(jobId)
  if (token) {
    token.paused = false
    updateScrapeJob(jobId, { status: 'running' })
  }
}
