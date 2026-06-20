// src/types/analysis.types.ts

export interface PageSpeedResult {
  mobile_score: number // 0–100
  desktop_score: number // 0–100
  fcp_ms: number | null // First Contentful Paint
  lcp_ms: number | null // Largest Contentful Paint
  cls: number | null // Cumulative Layout Shift
  tbt_ms: number | null // Total Blocking Time
  seo_metrics: string | null
  fetched_at: string
}

export interface WappalyzerResult {
  technologies: DetectedTech[]
  site_built_year: number | null
  is_mobile_responsive: boolean | null
}

export interface DetectedTech {
  name: string
  category: string
  version: string | null
}

export interface SslResult {
  ssl_valid: boolean
  redirects_to_https: boolean
  last_modified: string | null // from HTTP header
  status_code: number | null
  is_reachable: boolean
  site_content?: string | null
  contact_page_content?: string | null
  social_links?: Record<string, string> | null
}

export interface AnalysisResult {
  lead_id: number
  pagespeed: PageSpeedResult | null
  wappalyzer: WappalyzerResult | null
  ssl: SslResult | null
  error: string | null
}
