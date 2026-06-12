import { getDataSource } from '../index'
import type { DashboardStats, CityRoiStat } from '../../types'

export async function getDashboardStats(): Promise<DashboardStats> {
  const ds = getDataSource()
  const result = await ds.query(`
    SELECT
      COUNT(*) AS total_leads,
      SUM(CASE WHEN website_status = 'none' THEN 1 ELSE 0 END) AS no_website,
      SUM(CASE WHEN website_status = 'outdated' THEN 1 ELSE 0 END) AS outdated_website,
      SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) AS in_review,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
      SUM(CASE WHEN scraped_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS this_week,
      SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) AS verified_emails,
      SUM(CASE WHEN social_links IS NOT NULL THEN 1 ELSE 0 END) AS social_links_found
    FROM leads
  `)

  const row = result[0]
  return {
    total_leads: Number(row?.total_leads) || 0,
    no_website: Number(row?.no_website) || 0,
    outdated_website: Number(row?.outdated_website) || 0,
    in_review: Number(row?.in_review) || 0,
    approved: Number(row?.approved) || 0,
    closed: Number(row?.closed) || 0,
    this_week: Number(row?.this_week) || 0,
    verified_emails: Number(row?.verified_emails) || 0,
    social_links_found: Number(row?.social_links_found) || 0
  }
}

export interface ChartDataPoint {
  date: string
  scraped: number
  analyzed: number
  approved: number
  closed: number
}

export async function getChartData(days = 14): Promise<ChartDataPoint[]> {
  const ds = getDataSource()
  const rows = await ds.query(`
    WITH RECURSIVE dates(d) AS (
      SELECT date('now', '-' || (? - 1) || ' days')
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
  `, [days])
  return rows as ChartDataPoint[]
}

export interface FunnelDataPoint {
  stage: string
  count: number
  color: string
}

export async function getFunnelData(): Promise<FunnelDataPoint[]> {
  const ds = getDataSource()
  const result = await ds.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status IN ('scraped', 'qualified') THEN 1 ELSE 0 END) AS scraped,
      SUM(CASE WHEN status = 'review' OR ai_site_score IS NOT NULL THEN 1 ELSE 0 END) AS analyzed,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'outreach' THEN 1 ELSE 0 END) AS outreach,
      SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) AS replied,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed
    FROM leads
  `)

  const counts = result[0] || {}

  return [
    { stage: 'Scraped', count: Number(counts.scraped) || 0, color: '#3f3f46' },
    { stage: 'Analyzed', count: Number(counts.analyzed) || 0, color: '#1d4ed8' },
    { stage: 'Approved', count: Number(counts.approved) || 0, color: '#059669' },
    { stage: 'Outreach', count: Number(counts.outreach) || 0, color: '#7c3aed' },
    { stage: 'Replied', count: Number(counts.replied) || 0, color: '#0891b2' },
    { stage: 'Closed', count: Number(counts.closed) || 0, color: '#16a34a' }
  ]
}

export async function getCityRoiStats(): Promise<CityRoiStat[]> {
  const ds = getDataSource()
  const rows = await ds.query(`
    SELECT
      city,
      COUNT(*) as lead_count,
      ROUND(AVG(ai_site_score), 1) as avg_ai_score
    FROM leads
    WHERE city IS NOT NULL AND ai_site_score IS NOT NULL
    GROUP BY city
    HAVING lead_count >= 1
    ORDER BY avg_ai_score DESC, lead_count DESC
    LIMIT 10
  `)
  
  return rows.map((r: any) => ({
    city: r.city,
    lead_count: Number(r.lead_count),
    avg_ai_score: Number(r.avg_ai_score)
  }))
}
