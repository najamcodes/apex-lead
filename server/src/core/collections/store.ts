import { getDataSource } from '../../db'
import { randomUUID } from 'crypto'

export interface StoreRecordInput {
  collection: string
  orgId: number
  data: Record<string, unknown>
  mode?: 'upsert' | 'insert' | 'update'
  source?: string
  scrapedByUserId?: number
}

export interface StoreRecordResult {
  id: string
  collection: string
  isNew: boolean
}

/**
 * Store a record into the generic `collection_records` table.
 * - mode 'insert': always create a new row
 * - mode 'upsert': dedupe on (collection, org_id, unique_key) if the collection has one
 * - mode 'update': only update if a matching record exists
 *
 * For the built-in 'leads' collection, we delegate to insertLead() so the
 * existing LeadEntity + all its query functions keep working.
 */
export async function storeRecord(input: StoreRecordInput): Promise<string> {
  const { collection, orgId, data, mode = 'upsert', source } = input

  // Built-in leads collection: use the existing typed path for backward compat
  if (collection === 'leads') {
    return storeLead(data, mode)
  }

  // Generic collection: store in collection_records (JSONB)
  const ds = getDataSource()
  const id = randomUUID()
  const now = new Date().toISOString()

  // For upsert, check for an existing record by a configurable unique key.
  let existingId: string | null = null
  if (mode !== 'insert' && data.unique_key) {
    const isPostgres = process.env.DB_TYPE === 'postgres'
    const keyCondition = isPostgres
      ? "cr.data ->> 'unique_key' = :key"
      : "json_extract(cr.data, '$.unique_key') = :key"

    const existing = await ds.createQueryBuilder()
      .select('id')
      .from('collection_records', 'cr')
      .where('cr.collection = :collection', { collection })
      .andWhere('cr.org_id = :orgId', { orgId })
      .andWhere(keyCondition, { key: String(data.unique_key) })
      .getRawOne<{ id: string } | undefined>()
    existingId = existing?.id ?? null
  }

  if (mode === 'update' && !existingId) {
    throw new Error(`Update mode but no existing record found for collection '${collection}'`)
  }

  if (existingId && mode !== 'insert') {
    await ds.createQueryBuilder()
      .update('collection_records')
      .set({ data, updated_at: now, source: source ?? null })
      .where('id = :id', { id: existingId })
      .execute()
    return existingId
  }

  await ds.createQueryBuilder()
    .insert()
    .into('collection_records')
    .values({
      id,
      collection,
      org_id: orgId,
      data,
      source: source ?? null,
      created_at: now,
      updated_at: now,
    })
    .execute()

  return id
}

/** Query records in a collection. */
export async function queryCollection<T = Record<string, unknown>>(
  collection: string,
  orgId: number,
  opts: { limit?: number; offset?: number; where?: Record<string, unknown>; orderBy?: string; orderDir?: 'ASC' | 'DESC' } = {},
): Promise<{ data: T[]; total: number }> {
  const ds = getDataSource()
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0

  const qb = ds.createQueryBuilder()
    .select(['id', 'data', 'source', 'created_at', 'updated_at'])
    .from('collection_records', 'cr')
    .where('cr.collection = :collection', { collection })
    .andWhere('cr.org_id = :orgId', { orgId })
    .limit(limit)
    .offset(offset)

  if (opts.orderBy) {
    qb.orderBy(opts.orderBy, opts.orderDir ?? 'DESC')
  } else {
    qb.orderBy('cr.created_at', 'DESC')
  }

  const rows = await qb.getRawMany<{ id: string; data: string; source: string | null; created_at: string; updated_at: string }>()

  const total = await ds.createQueryBuilder()
    .select('COUNT(*)', 'count')
    .from('collection_records', 'cr')
    .where('cr.collection = :collection', { collection })
    .andWhere('cr.org_id = :orgId', { orgId })
    .getRawOne<{ count: number }>()

  interface RawCollectionRow {
    id: string
    data: string
    source: string
    created_at: string
    updated_at: string
  }

  const data = (rows as RawCollectionRow[]).map((r) => ({
    id: r.id,
    ...parseJson(r.data),
    _source: r.source,
    _created_at: r.created_at,
    _updated_at: r.updated_at,
  } as T))

  return { data, total: Number(total?.count ?? 0) }
}

/** Delete a record from a collection. */
export async function deleteRecord(collection: string, orgId: number, id: string): Promise<void> {
  await getDataSource().createQueryBuilder()
    .delete()
    .from('collection_records')
    .where('id = :id', { id })
    .andWhere('collection = :collection', { collection })
    .andWhere('org_id = :orgId', { orgId })
    .execute()
}

function parseJson(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) } catch { return {} }
}

// ─── Leads delegation (backward compat) ─────────────────────────

async function storeLead(data: Record<string, unknown>, mode: string): Promise<string> {
  const { insertLead } = await import('../../db/queries/leads.queries')
  if (mode === 'insert' || mode === 'upsert') {
    const result = await insertLead({
      business_name: data.business_name as string,
      category: (data.category as string) || '',
      city: (data.city as string) || '',
      country: (data.country as string) || 'United States',
      phone: (data.phone as string) ?? null,
      email: (data.email as string) ?? null,
      website_url: (data.website_url as string) ?? null,
      google_maps_url: (data.google_maps_url as string) ?? null,
      website_status: ((data.website_status as string) || 'unchecked') as import('@sdk/core/types').LeadInsert['website_status'],
      source: (data.source as string) ?? 'pipeline',
    })
    if (result?.id) return String(result.id)
  }
  throw new Error('Lead storage failed')
}
