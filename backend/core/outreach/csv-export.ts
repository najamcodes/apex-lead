// backend/core/outreach/csv-export.ts
import { getAllLeads } from '../../db/queries/leads.queries'

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const CSV_HEADERS = [
  'id',
  'business_name',
  'category',
  'city',
  'country',
  'phone',
  'email',
  'website_url',
  'website_status',
  'pagespeed_mobile',
  'pagespeed_desktop',
  'ssl_valid',
  'site_built_year',
  'ai_site_score',
  'ai_site_summary',
  'status',
  'source',
  'scraped_at'
] as const

export async function exportLeadsToCsv(): Promise<string> {
  const res = await getAllLeads({ page: 1, pageSize: 999999, status: 'all' })
  const data = res.data
  const header = CSV_HEADERS.join(',')
  const rows = data.map((lead) => CSV_HEADERS.map((col) => escapeCsv(lead[col])).join(','))
  return [header, ...rows].join('\n')
}