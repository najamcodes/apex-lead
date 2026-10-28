import { getDataSource } from '../index'
import type { DashboardStats, CityRoiStat } from '@sdk/core/types'
import { getTenantId, getCurrentUserId, canViewAllData } from './tenant'

const userScopeQb = (qb: any, alias: string = 'leads') => {
  if (!canViewAllData()) {
    qb.andWhere(`${alias}.scraped_by_user_id = :scopedUserId`, { scopedUserId: getCurrentUserId() })
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const ds = getDataSource()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const qb = ds.createQueryBuilder()
    .select('COUNT(*)', 'total_leads')
    .addSelect("SUM(CASE WHEN website_status = 'none' THEN 1 ELSE 0 END)", 'no_website')
    .addSelect("SUM(CASE WHEN website_status = 'outdated' THEN 1 ELSE 0 END)", 'outdated_website')
    .addSelect("SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END)", 'in_review')
    .addSelect("SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END)", 'approved')
    .addSelect("SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END)", 'closed')
    .addSelect("SUM(CASE WHEN scraped_at >= :weekAgo THEN 1 ELSE 0 END)", 'this_week')
    .addSelect("SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END)", 'verified_emails')
    .addSelect("SUM(CASE WHEN social_links IS NOT NULL THEN 1 ELSE 0 END)", 'social_links_found')
    .from('leads', 'leads')
    .where('leads.org_id = :orgId', { orgId: getTenantId() })
    .setParameters({ weekAgo })

  userScopeQb(qb)

  const result = await qb.getRawOne()
  const row = result || {}
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
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0]!)
  }

  const makeQb = () => {
    const qb = ds.createQueryBuilder()
      .from('leads', 'l')
      .where('l.org_id = :orgId', { orgId: getTenantId() })
    userScopeQb(qb, 'l')
    return qb
  }

  const scrapedRows = await makeQb()
    .select('date(scraped_at)', 'date')
    .addSelect('COUNT(*)', 'count')
    .andWhere('scraped_at >= :cutoff', { cutoff })
    .groupBy('date(scraped_at)')
    .getRawMany()

  const analyzedRows = await makeQb()
    .select('date(updated_at)', 'date')
    .addSelect('COUNT(*)', 'count')
    .andWhere('updated_at >= :cutoff', { cutoff })
    .andWhere('ai_site_score IS NOT NULL')
    .groupBy('date(updated_at)')
    .getRawMany()

  const approvedRows = await makeQb()
    .select('date(updated_at)', 'date')
    .addSelect('COUNT(*)', 'count')
    .andWhere('updated_at >= :cutoff', { cutoff })
    .andWhere("status = 'approved'")
    .groupBy('date(updated_at)')
    .getRawMany()

  const closedRows = await makeQb()
    .select('date(updated_at)', 'date')
    .addSelect('COUNT(*)', 'count')
    .andWhere('updated_at >= :cutoff', { cutoff })
    .andWhere("status = 'closed'")
    .groupBy('date(updated_at)')
    .getRawMany()

  return dates.map(d => ({
    date: d,
    scraped: Number(scrapedRows.find((r: any) => r.date === d)?.count || 0),
    analyzed: Number(analyzedRows.find((r: any) => r.date === d)?.count || 0),
    approved: Number(approvedRows.find((r: any) => r.date === d)?.count || 0),
    closed: Number(closedRows.find((r: any) => r.date === d)?.count || 0)
  }))
}

export interface FunnelDataPoint {
  stage: string
  count: number
  color: string
}

export async function getFunnelData(): Promise<FunnelDataPoint[]> {
  const ds = getDataSource()
  const qb = ds.createQueryBuilder()
    .select('COUNT(*)', 'total')
    .addSelect("SUM(CASE WHEN status IN ('scraped', 'qualified') THEN 1 ELSE 0 END)", 'scraped')
    .addSelect("SUM(CASE WHEN status = 'review' OR ai_site_score IS NOT NULL THEN 1 ELSE 0 END)", 'analyzed')
    .addSelect("SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END)", 'approved')
    .addSelect("SUM(CASE WHEN status = 'outreach' THEN 1 ELSE 0 END)", 'outreach')
    .addSelect("SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END)", 'replied')
    .addSelect("SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END)", 'closed')
    .from('leads', 'leads')
    .where('leads.org_id = :orgId', { orgId: getTenantId() })

  userScopeQb(qb)

  const result = await qb.getRawOne()
  const counts = result || {}

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
  const rows = await ds.createQueryBuilder()
    .select('city')
    .addSelect('COUNT(*)', 'lead_count')
    .addSelect('ROUND(AVG(ai_site_score), 1)', 'avg_ai_score')
    .from('leads', 'leads')
    .where('leads.org_id = :orgId', { orgId: getTenantId() })
    .andWhere('city IS NOT NULL')
    .andWhere('ai_site_score IS NOT NULL')
    .groupBy('city')
    .having('COUNT(*) >= 1')
    .orderBy('AVG(ai_site_score)', 'DESC')
    .addOrderBy('COUNT(*)', 'DESC')
    .limit(10)
    .getRawMany()
  
  return rows.map((r: any) => ({
    city: r.city,
    lead_count: Number(r.lead_count),
    avg_ai_score: Number(r.avg_ai_score)
  }))
}
