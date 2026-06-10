// src/db/queries/leads.queries.ts
import { getDb } from '../index'
import type { Lead, LeadInsert, LeadFilters, LeadStatus } from '../../types'

export function insertLead(data: LeadInsert): Lead | null {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO leads
      (business_name, category, city, country, phone, email,
       website_url, google_maps_url, website_status, source)
    VALUES
      (@business_name, @category, @city, @country, @phone, @email,
       @website_url, @google_maps_url, COALESCE(@website_status, 'unchecked'), @source)
  `)
  const result = stmt.run(data)
  // lastInsertRowid is 0 if row was ignored (duplicate)
  if (!result.lastInsertRowid) return null
  return getLeadById(result.lastInsertRowid as number)
}

export function getLeadById(id: number): Lead | null {
  return getDb().prepare('SELECT * FROM leads WHERE id = ?').get(id) as Lead | null
}

export function getAllLeads(filters: LeadFilters = {}): Lead[] {
  const conditions: string[] = []
  const params: Record<string, string> = {}

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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const sql = `SELECT * FROM leads ${where} ORDER BY scraped_at DESC`
  return getDb().prepare(sql).all(params) as Lead[]
}

export function updateLeadStatus(id: number, status: LeadStatus, notes?: string): void {
  getDb().prepare(`
    UPDATE leads
    SET status = ?, reviewer_notes = COALESCE(?, reviewer_notes), updated_at = datetime('now')
    WHERE id = ?
  `).run(status, notes ?? null, id)
}

export function deleteLead(id: number): void {
  getDb().prepare('DELETE FROM leads WHERE id = ?').run(id)
}
