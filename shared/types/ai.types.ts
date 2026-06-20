// src/types/ai.types.ts

export interface SiteScoreResult {
  score: number // 0–100 (0 = no site, 100 = excellent modern site)
  verdict: 'none' | 'poor' | 'outdated' | 'average' | 'good' | 'excellent'
  summary: string // One sentence e.g. "Site loads slowly, no mobile version, built circa 2015"
  issues: string[] // e.g. ["No SSL", "Not mobile responsive", "Outdated design"]
  opportunity_hook: string // One sentence pitch hook e.g. "This business would benefit from a modern landing page"
  icebreaker: string | null // A personalized one-sentence observation based on their website copy (e.g. "I loved your recent case study on X")
  decision_maker_name: string | null
  service_pitch: string | null
  model_used: string
}

export interface OutreachDraft {
  subject: string
  email_body: string
  linkedin_dm: string
  model_used: string
}

export interface AiTaskRequest {
  lead_id: number
  task: 'score_site' | 'draft_email'
}

export interface AiTaskProgress {
  lead_id: number
  task: string
  status: 'pending' | 'running' | 'done' | 'error'
  error?: string
}
