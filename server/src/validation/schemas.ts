import { z } from 'zod'

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export const LeadFiltersSchema = z.object({
  status: z.enum(['all', 'scraped', 'qualified', 'review', 'approved', 'outreach', 'replied', 'closed', 'skipped', 'unsubscribed']).optional(),
  website_status: z.enum(['all', 'unchecked', 'none', 'outdated', 'modern']).optional(),
  has_email: z.enum(['true', 'false']).optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
  email_verified: z.enum(['true', 'false']).optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
  city: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  source: z.enum(['all', 'google_maps', 'manual', 'extension']).optional(),
  min_priority: z.coerce.number().int().min(0).max(100).optional(),
  date_range: z.enum(['all', 'today', 'this_week', 'this_month']).optional(),
  ...PaginationSchema.shape,
  sortBy: z.enum(['priority_score', 'scraped_at', 'updated_at', 'ai_site_score', 'business_name', 'pagespeed_mobile', 'site_built_year']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
})

export const LeadInsertSchema = z.object({
  business_name: z.string().min(1).max(255),
  category: z.string().max(100).optional().default(''),
  city: z.string().max(100).optional().default(''),
  country: z.string().max(100).optional().default('United States'),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
  website_url: z.string().url().optional().nullable(),
  google_maps_url: z.string().url().optional().nullable(),
  website_status: z.enum(['unchecked', 'none', 'outdated', 'modern']).optional().default('unchecked'),
  ssl_valid: z.boolean().optional().nullable(),
  source: z.enum(['google_maps', 'manual', 'extension']).optional().default('manual'),
  ai_personalized_hook: z.string().optional().nullable(),
  ai_icebreaker: z.string().optional().nullable(),
  contact_name: z.string().max(100).optional().nullable(),
  review_rating: z.number().min(0).max(5).optional().nullable(),
  review_count: z.number().int().min(0).optional().nullable(),
  tech_stack: z.string().optional().nullable(),
  social_links: z.string().optional().nullable(),
  seo_metrics: z.string().optional().nullable(),
  email_verified: z.boolean().optional().nullable(),
})

export const LeadStatusUpdateSchema = z.object({
  status: z.enum(['scraped', 'qualified', 'review', 'approved', 'outreach', 'replied', 'closed', 'skipped', 'unsubscribed']),
  notes: z.string().optional(),
})

export const ScraperStartSchema = z.object({
  query: z.string().min(1).max(200),
  city: z.string().max(100),
  country: z.string().max(100).default('United States'),
  max_results: z.coerce.number().int().min(1).max(500).default(100),
  use_proxy: z.boolean().default(false),
})

export const ScraperJobQuerySchema = PaginationSchema.extend({
  status: z.enum(['all', 'running', 'paused', 'completed', 'failed', 'cancelled']).optional(),
})

export const AIScoreSchema = z.object({
  leadId: z.coerce.number().int().positive(),
  model: z.string().optional(),
})

export const AIDraftSchema = z.object({
  leadId: z.coerce.number().int().positive(),
  model: z.string().optional(),
})

export const AnalysisRunSchema = z.object({
  leadIds: z.array(z.coerce.number().int().positive()).min(1),
})

export const OutreachSendSchema = z.object({
  recordId: z.coerce.number().int().positive(),
})

export const OutreachBatchSchema = z.object({
  status: z.enum(['queued', 'sent', 'failed', 'replied', 'bounced']).optional(),
  ...PaginationSchema.shape,
})

export const OutreachRepliedSchema = z.object({
  recordId: z.coerce.number().int().positive(),
})

export const OutreachBouncedSchema = z.object({
  recordId: z.coerce.number().int().positive(),
})

export const OutreachScheduleSchema = z.object({
  input: z.object({
    lead_id: z.coerce.number().int().positive(),
    email: z.string().email(),
    subject: z.string().min(1).max(200),
    email_body: z.string().min(1),
    send_immediately: z.boolean().default(false),
    scheduled_at: z.string().datetime().optional(),
  }),
  businessName: z.string().min(1).max(255),
})

export const SMTPVerifySchema = z.object({
  accountId: z.coerce.number().int().positive().optional(),
})

export const EmailFinderLeadSchema = z.object({
  leadId: z.coerce.number().int().positive(),
})

export const EmailFinderBatchSchema = z.object({
  leadIds: z.array(z.coerce.number().int().positive()).min(1),
})

export const EmailVerifierBatchSchema = z.object({
  leadIds: z.array(z.coerce.number().int().positive()).min(1),
})

export const EmailAccountInsertSchema = z.object({
  email_address: z.string().email(),
  app_password: z.string().min(1),
  sender_name: z.string().max(100),
  daily_limit: z.coerce.number().int().min(1).max(1000).default(50),
})

export const EmailAccountUpdateSchema = EmailAccountInsertSchema.partial()

export const EmailAccountTestSchema = z.object({
  accountId: z.coerce.number().int().positive().optional(),
})

export const SettingsSchema = z.record(z.string(), z.unknown())

export const AuthLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const AuthRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const AuthRestoreSchema = z.object({
  userId: z.coerce.number().int().positive(),
})

export const UserInsertSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const UserUpdateSchema = z.object({
  permissions: z.array(z.string()).min(0),
})

export const BulkAnalyzeSchema = z.object({
  leadIds: z.array(z.coerce.number().int().positive()).min(1),
})

export const BulkScoreSchema = z.object({
  leadIds: z.array(z.coerce.number().int().positive()).min(1),
})

export const BulkApproveSchema = z.object({
  leadIds: z.array(z.coerce.number().int().positive()).min(1),
})

export const BulkScheduleSequencesSchema = z.object({
  leadIds: z.array(z.coerce.number().int().positive()).min(1),
  templateId: z.coerce.number().int().positive().optional(),
})

export const NoteUpdateSchema = z.object({
  body: z.string().min(1),
})

export const ExtensionLeadSchema = z.object({
  business_name: z.string().min(1).max(255),
  category: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  website_url: z.string().url().optional(),
  google_maps_url: z.string().url().optional(),
})

export const ExtensionLeadsSchema = z.array(ExtensionLeadSchema).min(1)

export const IdParamSchema = z.object({
  id: z.string().transform(Number).pipe(z.number().int().positive()),
})

export const TemplateInsertSchema = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
})

export const TemplateUpdateSchema = TemplateInsertSchema.partial()

export const ProxyConfigInsertSchema = z.object({
  name: z.string().min(1).max(255),
  server: z.string().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535).default(8080),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  type: z.enum(['http', 'https', 'socks5']).default('http'),
  enabled: z.boolean().default(true),
})

export const ProxyConfigUpdateSchema = ProxyConfigInsertSchema.partial()

export const OrganizationInsertSchema = z.object({
  name: z.string().min(1).max(255),
  tier: z.enum(['free', 'starter', 'pro', 'enterprise']).default('free'),
  billing_email: z.string().email().optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  max_users: z.coerce.number().int().min(1).default(5),
})

export const OrganizationUpdateSchema = OrganizationInsertSchema.partial()

export const UserOrgInsertSchema = z.object({
  user_id: z.coerce.number().int().positive(),
  org_id: z.coerce.number().int().positive(),
  role: z.enum(['org_admin', 'manager', 'user', 'viewer']).default('user'),
  permissions: z.array(z.string()).default([]),
})

export const UserOrgUpdateSchema = z.object({
  role: z.enum(['org_admin', 'manager', 'user', 'viewer']).optional(),
  permissions: z.array(z.string()).optional(),
})

export const SwitchOrgSchema = z.object({
  org_id: z.coerce.number().int().positive(),
})