// src/db/queries/leads.queries.ts
import { getDb } from '../index'
import type { Lead, LeadInsert, LeadFilters, LeadStatus } from '../../types'

export function insertLead(data: LeadInsert): Lead | null {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO leads
      (business_name, category, city, country, phone, email,
       website_url, google_maps_url, website_status, ssl_valid, source)
    VALUES
      (@business_name, @category, @city, @country, @phone, @email,
       @website_url, @google_maps_url, COALESCE(@website_status, 'unchecked'), @ssl_valid, @source)
  `)
  const result = stmt.run({
    phone: null,
    email: null,
    website_url: null,
    google_maps_url: null,
    website_status: null,
    ssl_valid: null,
    ...data
  })
  // lastInsertRowid is 0 if row was ignored (duplicate)
  if (!result.lastInsertRowid) return null
  return getLeadById(result.lastInsertRowid as number)
}

export function getLeadById(id: number): Lead | null {
  return getDb().prepare('SELECT * FROM leads WHERE id = ?').get(id) as Lead | null
}

export function getAllLeads(filters: LeadFilters = {}): import('../../types').PaginatedResponse<Lead> {
  const conditions: string[] = []
  const params: Record<string, any> = {}

  if (filters.status && filters.status !== 'all') {
    conditions.push('status = @status')
    params.status = filters.status
  }
  if (filters.website_status && filters.website_status !== 'all') {
    conditions.push('website_status = @website_status')
    params.website_status = filters.website_status
  }
  if (filters.city) {
    conditions.push('city LIKE @city')
    params.city = `%${filters.city}%`
  }
  if (filters.category) {
    conditions.push('category LIKE @category')
    params.category = `%${filters.category}%`
  }
  if (filters.search) {
    conditions.push('(business_name LIKE @search OR email LIKE @search OR phone LIKE @search)')
    params.search = `%${filters.search}%`
  }
  if (filters.source && filters.source !== 'all') {
    conditions.push('source = @source')
    params.source = filters.source
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  
  // Get total count
  const countSql = `SELECT COUNT(*) as count FROM leads ${where}`
  const totalRes = getDb().prepare(countSql).get(params) as { count: number }
  const total = totalRes.count

  // Apply pagination
  const page = filters.page || 1
  const pageSize = filters.pageSize || 50
  const offset = (page - 1) * pageSize
  
  params.limit = pageSize
  params.offset = offset

  const sql = `SELECT * FROM leads ${where} ORDER BY scraped_at DESC LIMIT @limit OFFSET @offset`
  const data = getDb().prepare(sql).all(params) as Lead[]
  
  return { data, total }
}

export function updateLeadStatus(id: number, status: LeadStatus, notes?: string): void {
  getDb()
    .prepare(
      `
    UPDATE leads
    SET status = ?, reviewer_notes = COALESCE(?, reviewer_notes), updated_at = datetime('now')
    WHERE id = ?
  `
    )
    .run(status, notes ?? null, id)
}

export function deleteLead(id: number): void {
  getDb().prepare('DELETE FROM leads WHERE id = ?').run(id)
}
