import type { RequestContext } from 'katal'
import { getDataSource } from '../../db'
import { getTenantId } from '../../db/queries/tenant'
import { CollectionRecordEntity } from '../../db/entities/CollectionRecordEntity'
import { LeadEntity } from '../../db/entities/LeadEntity'
import { deleteRecord } from '@sdk/core/collections/store'
import { sendError, HttpStatus } from '../../common'

export interface CollectionSummary {
  name: string
  label: string
  totalRecords: number
  lastUpdated: string | null
  isSystem: boolean
}

export class CollectionController {
  /**
   * GET /api/collections — list all available collections and their record counts.
   */
  static async list(c: RequestContext): Promise<Response> {
    try {
      const orgId = getTenantId()
      const ds = getDataSource()
      const summaries: CollectionSummary[] = []

      // 1. Leads collection (core table)
      const leadsCount = await ds.getRepository(LeadEntity).count({ where: { org_id: orgId } })
      const latestLead = await ds.getRepository(LeadEntity).findOne({
        where: { org_id: orgId },
        order: { updated_at: 'DESC' },
      })
      summaries.push({
        name: 'leads',
        label: 'Leads & Businesses',
        totalRecords: leadsCount,
        lastUpdated: latestLead?.updated_at ? (typeof latestLead.updated_at === 'string' ? latestLead.updated_at : latestLead.updated_at.toISOString()) : null,
        isSystem: true,
      })

      // 2. Generic collections in collection_records
      const customCollections = await ds.createQueryBuilder()
        .select('cr.collection', 'name')
        .addSelect('COUNT(*)', 'count')
        .addSelect('MAX(cr.updated_at)', 'last_updated')
        .from(CollectionRecordEntity, 'cr')
        .where('cr.org_id = :orgId', { orgId })
        .groupBy('cr.collection')
        .getRawMany<{ name: string; count: string | number; last_updated: string | null }>()

      for (const cc of customCollections) {
        summaries.push({
          name: cc.name,
          label: cc.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          totalRecords: Number(cc.count || 0),
          lastUpdated: cc.last_updated || null,
          isSystem: false,
        })
      }

      return c.json({ collections: summaries })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/collections/:name — get paginated records with search and schema discovery.
   */
  static async getByName(c: RequestContext): Promise<Response> {
    try {
      const name = (c.params?.name || c.req.param('name') || '') as string
      const orgId = getTenantId()
      const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
      const limit = Math.min(100, Math.max(10, parseInt(c.req.query('limit') || '50', 10)))
      const search = (c.req.query('search') || '').trim().toLowerCase()
      const sortBy = c.req.query('sortBy') || 'updated_at'
      const sortDir = (c.req.query('sortDir') || 'DESC').toUpperCase() as 'ASC' | 'DESC'
      const offset = (page - 1) * limit

      const ds = getDataSource()

      if (name === 'leads') {
        const qb = ds.getRepository(LeadEntity).createQueryBuilder('l')
          .where('l.org_id = :orgId', { orgId })

        if (search) {
          qb.andWhere(
            '(LOWER(l.business_name) LIKE :q OR LOWER(l.email) LIKE :q OR LOWER(l.city) LIKE :q OR LOWER(l.category) LIKE :q OR LOWER(l.website_url) LIKE :q)',
            { q: `%${search}%` }
          )
        }

        const total = await qb.getCount()
        const allowedSorts = ['business_name', 'city', 'category', 'scraped_at', 'updated_at', 'status']
        const safeSort = allowedSorts.includes(sortBy) ? `l.${sortBy}` : 'l.updated_at'
        qb.orderBy(safeSort, sortDir).skip(offset).take(limit)

        const leads = await qb.getMany()
        const records = leads.map(l => ({
          id: String(l.id),
          business_name: l.business_name,
          email: l.email,
          phone: l.phone,
          website_url: l.website_url,
          city: l.city,
          category: l.category,
          score: l.ai_site_score ?? l.priority_score ?? null,
          status: l.status,
          website_status: l.website_status,
          source: l.source,
          created_at: l.scraped_at ? (typeof l.scraped_at === 'string' ? l.scraped_at : l.scraped_at.toISOString()) : '',
          updated_at: l.updated_at ? (typeof l.updated_at === 'string' ? l.updated_at : l.updated_at.toISOString()) : '',
        }))

        const columns = [
          { key: 'business_name', label: 'Business Name', type: 'string' },
          { key: 'email', label: 'Email', type: 'string' },
          { key: 'phone', label: 'Phone', type: 'string' },
          { key: 'website_url', label: 'Website', type: 'url' },
          { key: 'city', label: 'City', type: 'string' },
          { key: 'category', label: 'Category', type: 'string' },
          { key: 'score', label: 'Score', type: 'number' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: 'created_at', label: 'Created At', type: 'date' },
        ]

        return c.json({
          collection: 'leads',
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          columns,
          records,
        })
      }

      // Generic collection
      const qb = ds.getRepository(CollectionRecordEntity).createQueryBuilder('cr')
        .where('cr.collection = :collection', { collection: name })
        .andWhere('cr.org_id = :orgId', { orgId })

      if (search) {
        qb.andWhere('(LOWER(cr.data) LIKE :q OR LOWER(cr.source) LIKE :q)', { q: `%${search}%` })
      }

      const total = await qb.getCount()
      qb.orderBy('cr.updated_at', sortDir).skip(offset).take(limit)

      const rows = await qb.getMany()
      const records = rows.map(r => {
        let parsed: Record<string, unknown> = {}
        try { parsed = JSON.parse(r.data) } catch {}
        return {
          id: r.id,
          ...parsed,
          _source: r.source,
          _created_at: r.created_at,
          _updated_at: r.updated_at,
        }
      })

      const keySet = new Set<string>()
      for (const r of records) {
        for (const k of Object.keys(r)) {
          if (k !== 'id') keySet.add(k)
        }
      }

      const columns = Array.from(keySet).map(k => ({
        key: k,
        label: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: typeof (records[0] as Record<string, unknown>)?.[k] === 'number' ? 'number' : k.includes('url') ? 'url' : 'string',
      }))

      return c.json({
        collection: name,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        columns,
        records,
      })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * PUT /api/collections/:name/:id — update a record.
   */
  static async update(c: RequestContext): Promise<Response> {
    try {
      const name = (c.params?.name || c.req.param('name') || '') as string
      const id = (c.params?.id || c.req.param('id') || '') as string
      const orgId = getTenantId()
      const body = await c.req.json()
      const now = new Date().toISOString()
      const ds = getDataSource()

      if (name === 'leads') {
        const repo = ds.getRepository(LeadEntity)
        const existing = await repo.findOneBy({ id: parseInt(id, 10), org_id: orgId })
        if (!existing) return c.json({ error: 'Lead not found' }, 404)

        Object.assign(existing, body, { updated_at: new Date() })
        await repo.save(existing)
        return c.json({ success: true, record: existing })
      }

      const repo = ds.getRepository(CollectionRecordEntity)
      const existing = await repo.findOneBy({ id, collection: name, org_id: orgId })
      if (!existing) return c.json({ error: 'Record not found' }, 404)

      let currentData: Record<string, unknown> = {}
      try { currentData = JSON.parse(existing.data) } catch {}
      const merged: Record<string, unknown> = { ...currentData, ...body }
      delete merged.id
      delete merged._source
      delete merged._created_at
      delete merged._updated_at

      existing.data = JSON.stringify(merged)
      existing.updated_at = now
      await repo.save(existing)

      return c.json({ success: true, record: { id: existing.id, ...merged, _updated_at: now } })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * DELETE /api/collections/:name/:id — delete a record.
   */
  static async delete(c: RequestContext): Promise<Response> {
    try {
      const name = (c.params?.name || c.req.param('name') || '') as string
      const id = (c.params?.id || c.req.param('id') || '') as string
      const orgId = getTenantId()
      const ds = getDataSource()

      if (name === 'leads') {
        await ds.getRepository(LeadEntity).delete({ id: parseInt(id, 10), org_id: orgId })
        return c.json({ success: true })
      }

      await deleteRecord(name, orgId, id)
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/collections/:name/export — export collection records to CSV or JSON.
   */
  static async export(c: RequestContext): Promise<Response> {
    try {
      const name = (c.params?.name || c.req.param('name') || '') as string
      const orgId = getTenantId()
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
      const format = body.format === 'json' ? 'json' : 'csv'
      const ds = getDataSource()

      let rawRecords: Array<Record<string, unknown>> = []

      if (name === 'leads') {
        const leads = await ds.getRepository(LeadEntity).find({
          where: { org_id: orgId },
          order: { id: 'DESC' },
          take: 5000,
        })
        rawRecords = leads.map(l => ({ ...l }))
      } else {
        const rows = await ds.getRepository(CollectionRecordEntity).find({
          where: { collection: name, org_id: orgId },
          order: { updated_at: 'DESC' },
          take: 5000,
        })
        rawRecords = rows.map(r => {
          let d: Record<string, unknown> = {}
          try { d = JSON.parse(r.data) } catch {}
          return { id: r.id, ...d, _created_at: r.created_at }
        })
      }

      if (format === 'json') {
        c.header('Content-Disposition', `attachment; filename="${name}-export.json"`)
        c.header('Content-Type', 'application/json')
        return c.text(JSON.stringify(rawRecords, null, 2))
      }

      // Convert to CSV
      if (rawRecords.length === 0) {
        return c.text('No records found', 200)
      }

      const headers = Array.from(new Set(rawRecords.flatMap(r => Object.keys(r))))
      const csvLines = [headers.join(',')]

      for (const rec of rawRecords) {
        const row = headers.map(h => {
          const val = rec[h]
          if (val === null || val === undefined) return '""'
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
          return `"${str.replace(/"/g, '""')}"`
        })
        csvLines.push(row.join(','))
      }

      c.header('Content-Disposition', `attachment; filename="${name}-export.csv"`)
      c.header('Content-Type', 'text/csv')
      return c.text(csvLines.join('\n'))
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
