// shared/types/collection.types.ts
// Collection definitions — the generic storage layer.
// A "collection" is a typed table. 'leads' is one collection;
// 'amazon_products' and 'facebook_posts' are others the user can define.

export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'datetime' | 'json'

export interface CollectionField {
  /** Field name / column key. */
  name: string
  /** Display label. */
  label?: string
  type: FieldType
  /** Whether this field can be null. */
  nullable?: boolean
  /** Whether this field is indexed for fast lookups. */
  indexed?: boolean
  /** Whether this field is part of the unique key (for dedup on insert). */
  uniqueKey?: boolean
  /** Default value if not provided. */
  default?: unknown
  /** Help text. */
  description?: string
}

export interface CollectionDefinition {
  /** Collection id, e.g. 'leads', 'amazon_products'. kebab-case. */
  id: string
  name: string
  description?: string
  /** Field definitions. */
  fields: CollectionField[]
  /** Whether this collection is user-defined (vs. built-in system). */
  system?: boolean
  org_id?: number
  created_at?: string
}

export interface CollectionRecord {
  id: string | number
  collection: string
  org_id: number
  data: Record<string, unknown>
  created_at: string
  updated_at: string
  /** Where this record came from (pipeline id + node id). */
  source?: string
}
