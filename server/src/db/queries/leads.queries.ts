import { getTenantId, getCurrentUserId, getUserScopeFilter, canViewAllData } from './tenant'
import { getDataSource } from '../index'
import { LeadEntity } from '../entities/LeadEntity'
import type { LeadInsert, LeadFilters, LeadStatus } from '@sdk/core/types'
import type { FindOptionsWhere } from 'typeorm'

export async function insertLead(data: LeadInsert): Promise<LeadEntity | null> {
  const repo = getDataSource().getRepository(LeadEntity)
  
  try {
    const orgId = getTenantId()
    const businessName = data.business_name || 'Unnamed Business'
    const city = data.city || ''

    // Return existing lead if duplicate by unique constraint
    const existing = await repo.findOne({
      where: { org_id: orgId, business_name: businessName, city },
    })
    if (existing) return existing

    const result = await repo.insert({
      org_id: orgId,
      scraped_by_user_id: getCurrentUserId(),
      business_name: businessName,
      category: data.category || '',
      city,
      country: data.country || '',
      phone: data.phone ?? null,
      email: data.email ?? null,
      website_url: data.website_url ?? null,
      google_maps_url: data.google_maps_url ?? null,
      website_status: data.website_status ?? 'unchecked',
      ssl_valid: data.ssl_valid ?? null,
      source: data.source || 'manual',
      ai_personalized_hook: data.ai_personalized_hook ?? null,
      ai_icebreaker: data.ai_icebreaker ?? null,
      contact_name: data.contact_name ?? null,
      review_rating: data.review_rating ?? null,
      review_count: data.review_count ?? null,
      tech_stack: data.tech_stack ?? null,
      social_links: data.social_links ?? null,
      seo_metrics: data.seo_metrics ?? null,
      email_verified: data.email_verified ?? null,
    })

    const id = result.identifiers[0]?.id || (result.raw as number)
    if (!id) return null
    return await getLeadById(id)
  } catch (err) {
    console.error('[db] insertLead error:', err)
    return null
  }
}

export async function insertBatchLeads(leads: LeadInsert[]): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0
  for (const item of leads) {
    if (!item || !item.business_name) {
      skipped++
      continue
    }
    const res = await insertLead(item)
    if (res) imported++
    else skipped++
  }
  return { imported, skipped }
}

export async function getLeadById(id: number): Promise<LeadEntity | null> {
  const repo = getDataSource().getRepository(LeadEntity)
  const where: FindOptionsWhere<LeadEntity> = { id, org_id: getTenantId() }
  if (!canViewAllData()) {
    where.scraped_by_user_id = getCurrentUserId()
  }
  return await repo.findOne({ where })
}

export async function getAllLeads(filters: LeadFilters = {}): Promise<import('@sdk/core/types').PaginatedResponse<LeadEntity>> {
  const repo = getDataSource().getRepository(LeadEntity)
  const qb = repo.createQueryBuilder('lead')
  qb.where('lead.org_id = :orgId', { orgId: getTenantId() })

  // Per-user data isolation: regular users only see their own scraped data
  const scope = getUserScopeFilter('lead')
  if (scope.clause) {
    qb.andWhere(scope.clause.replace('AND ', ''), scope.params)
  }

  if (filters.status && filters.status !== 'all') {
    qb.andWhere('lead.status = :status', { status: filters.status })
  }
  if (filters.website_status && filters.website_status !== 'all') {
    qb.andWhere('lead.website_status = :website_status', { website_status: filters.website_status })
  }
  if (filters.has_email === true) {
    qb.andWhere("lead.email IS NOT NULL AND lead.email != ''")
  } else if (filters.has_email === false) {
    qb.andWhere("(lead.email IS NULL OR lead.email = '')")
  }
  if (filters.email_verified === true) {
    qb.andWhere("lead.email_verified = 1")
  } else if (filters.email_verified === false) {
    qb.andWhere("(lead.email_verified = 0 OR lead.email_verified IS NULL)")
  }
  if (filters.city) {
    qb.andWhere('lead.city LIKE :city', { city: `%${filters.city}%` })
  }
  if (filters.category) {
    qb.andWhere('lead.category LIKE :category', { category: `%${filters.category}%` })
  }
  if (filters.search) {
    qb.andWhere('(lead.business_name LIKE :search OR lead.email LIKE :search OR lead.phone LIKE :search)', { search: `%${filters.search}%` })
  }
  if (filters.source && filters.source !== 'all') {
    qb.andWhere('lead.source = :source', { source: filters.source })
  }
  if (filters.min_priority !== undefined) {
    qb.andWhere('lead.priority_score >= :min_priority', { min_priority: filters.min_priority })
  }
  if (filters.date_range && filters.date_range !== 'all') {
    const now = new Date()
    if (filters.date_range === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      qb.andWhere('lead.scraped_at >= :startOfDay', { startOfDay: startOfDay.toISOString() })
    } else if (filters.date_range === 'this_week') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      qb.andWhere('lead.scraped_at >= :sevenDaysAgo', { sevenDaysAgo: sevenDaysAgo.toISOString() })
    } else if (filters.date_range === 'this_month') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      qb.andWhere('lead.scraped_at >= :thirtyDaysAgo', { thirtyDaysAgo: thirtyDaysAgo.toISOString() })
    }
  }

  const page = filters.page || 1
  const pageSize = filters.pageSize || 50
  const offset = (page - 1) * pageSize

  if (filters.sortBy) {
    const dir = filters.sortDir === 'asc' ? 'ASC' : 'DESC'
    qb.orderBy(`lead.${filters.sortBy}`, dir, 'NULLS LAST')
  } else {
    qb.orderBy('lead.priority_score', 'DESC', 'NULLS LAST')
  }

  qb.skip(offset).take(pageSize)

  const [data, total] = await qb.getManyAndCount()
  return { data, total }
}

export async function updateLeadStatus(id: number, status: LeadStatus, notes?: string): Promise<void> {
  const repo = getDataSource().getRepository(LeadEntity)
  const updateData: Partial<LeadEntity> = { status, updated_at: new Date() }
  if (notes !== undefined) {
    updateData.reviewer_notes = notes
  }
  const where: FindOptionsWhere<LeadEntity> = { id, org_id: getTenantId() }
  if (!canViewAllData()) {
    where.scraped_by_user_id = getCurrentUserId()
  }
  await repo.update(where, updateData)
}

export async function deleteLead(id: number): Promise<void> {
  const repo = getDataSource().getRepository(LeadEntity)
  const where: FindOptionsWhere<LeadEntity> = { id, org_id: getTenantId() }
  if (!canViewAllData()) {
    where.scraped_by_user_id = getCurrentUserId()
  }
  await repo.delete(where)
}
