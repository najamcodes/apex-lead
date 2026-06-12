// src/db/queries/scrape-jobs.queries.ts
import { getDb } from '../index'
import type { ScrapeJob } from '../../types/scraper.types'

export function insertScrapeJob(
  job: Omit<
    ScrapeJob,
    'progress' | 'found' | 'errors' | 'started_at' | 'completed_at' | 'error_message'
  >
): void {
  getDb()
    .prepare(
      `
    INSERT INTO scrape_jobs (id, query, city, country, max_results, status)
    VALUES (@id, @query, @city, @country, @max_results, @status)
  `
    )
    .run(job)
}

export function updateScrapeJob(id: string, patch: Partial<ScrapeJob>): void {
  const fields = Object.keys(patch)
    .map((k) => `${k} = @${k}`)
    .join(', ')
  getDb()
    .prepare(`UPDATE scrape_jobs SET ${fields} WHERE id = ?`)
    .run({ ...patch }, id)
}

export function getAllScrapeJobs(
  pagination?: import('../../types').PaginationParams
): import('../../types').PaginatedResponse<ScrapeJob> {
  const db = getDb()
  const page = pagination?.page || 1
  const pageSize = pagination?.pageSize || 50
  const offset = (page - 1) * pageSize

  const totalRes = db.prepare('SELECT COUNT(*) as count FROM scrape_jobs').get() as {
    count: number
  }

  const data = db
    .prepare('SELECT * FROM scrape_jobs ORDER BY started_at DESC LIMIT @limit OFFSET @offset')
    .all({ limit: pageSize, offset }) as ScrapeJob[]

  return { data, total: totalRes.count }
}

export function getScrapeJobById(id: string): ScrapeJob | null {
  return getDb().prepare('SELECT * FROM scrape_jobs WHERE id = ?').get(id) as ScrapeJob | null
}

export function deleteScrapeJob(id: string): void {
  getDb().prepare('DELETE FROM scrape_jobs WHERE id = ?').run(id)
}
