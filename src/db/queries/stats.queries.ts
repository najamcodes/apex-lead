// src/db/queries/stats.queries.ts
import { getDb } from '../index'
import type { DashboardStats } from '../../types'

export function getDashboardStats(): DashboardStats {
  const db = getDb()
  const row = db
    .prepare(
      `
    SELECT
      COUNT(*) AS total_leads,
      SUM(CASE WHEN website_status = 'none' THEN 1 ELSE 0 END) AS no_website,
      SUM(CASE WHEN website_status = 'outdated' THEN 1 ELSE 0 END) AS outdated_website,
      SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) AS in_review,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
      SUM(CASE WHEN scraped_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS this_week
    FROM leads
  `
    )
    .get() as DashboardStats

  // Provide defaults in case everything is null (empty table)
  return {
    total_leads: row.total_leads || 0,
    no_website: row.no_website || 0,
    outdated_website: row.outdated_website || 0,
    in_review: row.in_review || 0,
    approved: row.approved || 0,
    closed: row.closed || 0,
    this_week: row.this_week || 0
  }
}

export interface ChartDataPoint {
  date: string // YYYY-MM-DD
  scraped: number
  analyzed: number
  approved: number
  closed: number
}

export function getChartData(days = 14): ChartDataPoint[] {
  const db = getDb()
  const rows = db
    .prepare(
      `
    WITH RECURSIVE dates(d) AS (
      SELECT date('now', '-${days - 1} days')
      UNION ALL
      SELECT date(d, '+1 day') FROM dates WHERE d < date('now')
    )
    SELECT
      d AS date,
      COUNT(CASE WHEN date(l.scraped_at) = d THEN 1 END) AS scraped,
      COUNT(CASE WHEN date(l.updated_at) = d AND l.ai_site_score IS NOT NULL THEN 1 END) AS analyzed,
      COUNT(CASE WHEN date(l.updated_at) = d AND l.status = 'approved' THEN 1 END) AS approved,
      COUNT(CASE WHEN date(l.updated_at) = d AND l.status = 'closed' THEN 1 END) AS closed
    FROM dates
    LEFT JOIN leads l ON date(l.scraped_at) = d
    GROUP BY d
    ORDER BY d ASC
  `
    )
    .all() as ChartDataPoint[]
  return rows
}

export interface FunnelDataPoint {
  stage: string
  count: number
  color: string
}

export function getFunnelData(): FunnelDataPoint[] {
  const db = getDb()
  const counts = db
    .prepare(
      `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status IN ('scraped', 'qualified') THEN 1 ELSE 0 END) AS scraped,
      SUM(CASE WHEN status = 'review' OR ai_site_score IS NOT NULL THEN 1 ELSE 0 END) AS analyzed,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'outreach' THEN 1 ELSE 0 END) AS outreach,
      SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) AS replied,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed
    FROM leads
  `
    )
    .get() as any

  return [
    { stage: 'Scraped', count: counts.scraped ?? 0, color: '#3f3f46' },
    { stage: 'Analyzed', count: counts.analyzed ?? 0, color: '#1d4ed8' },
    { stage: 'Approved', count: counts.approved ?? 0, color: '#059669' },
    { stage: 'Outreach', count: counts.outreach ?? 0, color: '#7c3aed' },
    { stage: 'Replied', count: counts.replied ?? 0, color: '#0891b2' },
    { stage: 'Closed', count: counts.closed ?? 0, color: '#16a34a' }
  ]
}
