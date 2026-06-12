// extension/shared/types.ts

export interface ExtractedPageData {
  business_name: string
  website_url:   string
  phone:         string | null
  email:         string | null
  address:       string | null
  city:          string | null
  category:      string | null
}

export interface LeadPayload {
  business_name:   string
  website_url:     string
  phone?:          string
  email?:          string
  city?:           string
  country?:        string
  category?:       string
  google_maps_url?: string
}

export interface ApiResponse {
  ok:        boolean
  lead?:     { id: number; business_name: string }
  duplicate?: boolean
  error?:    string
}

export interface AppStatus {
  ok:      boolean
  app:     string
  version: string
}

// Message types between content script, service worker, and popup
export type Message =
  | { type: 'GET_PAGE_DATA' }
  | { type: 'PAGE_DATA'; data: ExtractedPageData }
  | { type: 'ADD_LEAD'; payload: LeadPayload }
  | { type: 'ADD_LEAD_RESULT'; result: ApiResponse }
  | { type: 'APP_STATUS'; status: AppStatus | null }
  | { type: 'GET_RECENT_LEADS' }
  | { type: 'RECENT_LEADS'; leads: any[] }
