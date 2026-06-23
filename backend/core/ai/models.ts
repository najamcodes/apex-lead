// electron/ai/models.ts

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export const MODELS = {
  // Primary — cheapest capable model for structured tasks
  FLASH: 'deepseek/deepseek-v4-flash',
  // Fallback — if Flash is unavailable
  FLASH_BACKUP: 'qwen/qwen3.6-flash',
  // Heavy reasoning — use sparingly
  PRO: 'deepseek/deepseek-v4-pro',
  // Free tier — for dev/testing only
  FREE: 'deepseek/deepseek-v4-flash:free'
} as const

export type ModelKey = keyof typeof MODELS
export type ModelId = (typeof MODELS)[ModelKey]

// Defaults per task — user can override in settings
export const DEFAULT_MODELS = {
  site_scoring: MODELS.FLASH,
  email_draft: MODELS.FLASH,
  dm_draft: MODELS.FLASH
} as const
