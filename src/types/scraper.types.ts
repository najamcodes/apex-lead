// src/types/scraper.types.ts

export type ScrapeStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface ScrapeJob {
  id: string // uuid
  query: string // e.g. "hair salons"
  city: string // e.g. "Rawalpindi"
  country: string // e.g. "Pakistan"
  max_results: number // e.g. 100
  status: ScrapeStatus
  progress: number // 0–100
  found: number // leads extracted so far
  errors: number // failed extractions
  started_at: string | null
  completed_at: string | null
  error_message: string | null
}

export interface ScrapeJobConfig {
  query: string
  city: string
  country: string
  max_results: number
  use_proxy: boolean
  website_filter?: 'all' | 'required' | 'none'
  phone_filter?: 'all' | 'required' | 'none'
  email_filter?: 'all' | 'required' | 'none'
}

// IPC event emitted during a scrape run (main → renderer)
export interface ScrapeProgressEvent {
  job_id: string
  found: number
  total: number
  current_business: string
  status: ScrapeStatus
  error?: string
}

// Raw data extracted from a single Google Maps listing
export interface RawMapListing {
  business_name: string
  category: string
  address: string
  city: string
  phone: string | null
  email: string | null
  website_url: string | null
  website_status?: string | null
  ssl_valid?: boolean | null
  google_maps_url: string | null
  rating: number | null
  review_count: number | null
}

export interface ProxyConfig {
  url: string
  username: string
  password: string
}
