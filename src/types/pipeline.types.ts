// src/types/pipeline.types.ts

export type TargetStatus = 'active' | 'paused' | 'error'

export interface ScrapeTarget {
  id:             number
  label:          string          // friendly name e.g. "Karachi Restaurants"
  query:          string          // e.g. "restaurants"
  city:           string          // e.g. "Karachi"
  country:        string
  max_per_run:    number          // max leads to scrape per night
  min_ai_score:   number          // only keep leads with score >= this (0 = keep all)
  website_filter: 'all' | 'none_only' | 'outdated_only'
  status:         TargetStatus
  use_proxy:      boolean
  last_run_at:    string | null
  next_run_at:    string | null
  total_found:    number          // lifetime leads found
  created_at:     string
}

export interface ScrapeTargetInsert {
  label:          string
  query:          string
  city:           string
  country:        string
  max_per_run:    number
  min_ai_score:   number
  website_filter: ScrapeTarget['website_filter']
  use_proxy:      boolean
}

export interface DigestRun {
  id:               number
  run_at:           string         // when the nightly run executed
  targets_run:      number         // how many targets were scraped
  total_scraped:    number         // raw leads pulled
  total_qualified:  number         // passed AI score threshold
  total_no_website: number         // no website leads
  total_new:        number         // not already in DB (not duplicates)
  digest_sent:      boolean        // whether digest email was sent
  digest_error:     string | null  // error message if send failed
  top_leads:        string         // JSON: top 5 leads for the digest preview
}

export type QueryProfileStatus = 'active' | 'paused' | 'error'

export interface QueryProfile {
  id:               number
  label:            string         // e.g. "B2B Professional Services"
  target_audience:  string         // "Lawyers, Accountants, Dentists"
  core_offer:       string         // "Web design, SEO"
  cities:           string         // JSON array: ["London", "Manchester"]
  countries:        string         // JSON array: ["UK"]
  status:           QueryProfileStatus
  queries_generated: number        // Lifetime queries made
  created_at:       string
  updated_at:       string
}

export interface QueryProfileInsert {
  label:            string
  target_audience:  string
  core_offer:       string
  cities:           string[]
  countries:        string[]
  status?:          QueryProfileStatus
}
