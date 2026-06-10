// src/db/queries/scrape-jobs.queries.ts
import { getDb } from '../index'
import type { ScrapeJob } from '../../types/scraper.types'

export function insertScrapeJob(job: Omit<ScrapeJob, 'progress' | 'found' | 'errors' | 'started_at' | 'completed_at' | 'error_message'>): void {
  getDb().prepare(`
    INSERT INTO scrape_jobs (id, query, city, country, max_results, status)
    VALUES (@id, @query, @city, @country, @max_results, @status)
  `).run(job)
}

export function updateScrapeJob(id: string, patch: Partial<ScrapeJob>): void {
  const fields = Object.keys(patch)
    .map((k) => `${k} = @${k}`)
    .join(', ')
  getDb().prepare(`UPDATE scrape_jobs SET ${fields} WHERE id = ?`).run({ ...patch }, id)
}

export function getAllScrapeJobs(): ScrapeJob[] {
  return getDb().prepare(
    'SELECT * FROM scrape_jobs ORDER BY started_at DESC LIMIT 50'
  ).all() as ScrapeJob[]
}

export function getScrapeJobById(id: string): ScrapeJob | null {
  return getDb().prepare('SELECT * FROM scrape_jobs WHERE id = ?').get(id) as ScrapeJob | null
}
