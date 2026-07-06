// electron/outreach/csv-export.ts
import { dialog } from 'electron'
import fs from 'fs'
import { getAllLeads } from '../../backend/db/queries/leads.queries'
import type { Lead } from '../../shared/types'

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const CSV_HEADERS: (keyof Lead)[] = [
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
]

export async function exportLeadsToCsv(): Promise<string | null> {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Export Leads',
    defaultPath: `leadhunter-export-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  })

  if (canceled || !filePath) return null

  const res = await getAllLeads({ page: 1, pageSize: 999999, status: 'all' })
  const data = res.data
  const header = CSV_HEADERS.join(',')
  const rows = data.map((lead) => CSV_HEADERS.map((col) => escapeCsv(lead[col])).join(','))

  const csv = [header, ...rows].join('\n')
  fs.writeFileSync(filePath, csv, 'utf8')
  return filePath
}

