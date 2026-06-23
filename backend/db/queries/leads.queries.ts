import { getTenantId } from './tenant'
import { getDataSource } from '../index'
import { LeadEntity } from '../entities/LeadEntity'
import type { LeadInsert, LeadFilters, LeadStatus } from '../../../shared/types'

export async function insertLead(data: LeadInsert): Promise<LeadEntity | null> {
  const repo = getDataSource().getRepository(LeadEntity)
  
  // Try to insert
  try {
    const lead = repo.create({
    org_id: getTenantId(),
    business_name: data.business_name,
      category: data.category,
      city: data.city,
      country: data.country,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website_url: data.website_url ?? null,
      google_maps_url: data.google_maps_url ?? null,
      website_status: data.website_status ?? 'unchecked',
      ssl_valid: data.ssl_valid ?? null,
      source: data.source,
      ai_personalized_hook: data.ai_personalized_hook ?? null,
      ai_icebreaker: data.ai_icebreaker ?? null,
      contact_name: data.contact_name ?? null,
      review_rating: data.review_rating ?? null,
      review_count: data.review_count ?? null,
      tech_stack: data.tech_stack ?? null,
      social_links: data.social_links ?? null,
      seo_metrics: data.seo_metrics ?? null,
      email_verified: data.email_verified ?? null
    })

    const result = await repo.createQueryBuilder()
      .insert()
      .into(LeadEntity)
      .values(lead)
      .orIgnore() // SQLite ON CONFLICT DO NOTHING
      .execute()

    if (!result.identifiers[0]) {
      // It means it was ignored
      return null
    }

    return await getLeadById(result.identifiers[0].id)
  } catch (err) {
    return null
  }
}

export async function getLeadById(id: number): Promise<LeadEntity | null> {
  const repo = getDataSource().getRepository(LeadEntity)
  return await repo.findOne({ where: { id, org_id: getTenantId() } })
}

export async function getAllLeads(filters: LeadFilters = {}): Promise<import('../../../shared/types').PaginatedResponse<LeadEntity>> {
  const repo = getDataSource().getRepository(LeadEntity)
  const qb = repo.createQueryBuilder('lead')
  qb.where('lead.org_id = :orgId', { orgId: getTenantId() })

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
  const updateData: any = { status, updated_at: new Date() }
  if (notes !== undefined) {
    updateData.reviewer_notes = notes
  }
  await repo.update({ id, org_id: getTenantId() }, updateData)
}

export async function deleteLead(id: number): Promise<void> {
  const repo = getDataSource().getRepository(LeadEntity)
  await repo.delete({ id, org_id: getTenantId() })
}
