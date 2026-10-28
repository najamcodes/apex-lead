// src/services/api.interface.ts
// Typed interface for the API service layer.
// Both the Electron adapter (api) and the Web adapter (fetch)
// implement this same interface. Stores and screens import `api` from
// './api.ts' which resolves to the correct adapter at build time.

import type {
  Lead,
  LeadInsert,
  LeadFilters,
  PaginatedResponse,
  PaginationParams,
  DashboardStats,
  CityRoiStat,
  AppSettings,
  EmailTemplate,
  EmailAccount,
  EmailAccountInsert
} from '@sdk/core/types'
import type { ScrapeJob, ScrapeJobConfig, ScrapeProgressEvent } from '@sdk/core/types'
import type { SiteScoreResult, OutreachDraft } from '@sdk/core/types'
import type { AnalysisResult } from '@sdk/core/types'
import type { OutreachRecord, SendResult, SequenceSummary } from '@sdk/core/types'
import type { ActivityRecord, NoteRecord } from '@sdk/core/types'
import type {
  PipelineDefinition,
  PipelineRun,
  NodeTypeDescriptor,
} from '@sdk/core/types'
import type { CollectionDefinition } from '@sdk/core/types'

export interface IApiService {
  leads: {
    getAll: (filters?: LeadFilters) => Promise<PaginatedResponse<Lead>>
    getById: (id: number) => Promise<Lead | null>
    insert: (data: LeadInsert) => Promise<Lead>
    insertBatch: (data: LeadInsert[]) => Promise<{ imported: number; skipped: number }>
    updateStatus: (id: number, status: string, notes?: string) => Promise<void>
    delete: (id: number) => Promise<void>
  }
  stats: {
    getDashboard: () => Promise<DashboardStats>
    getCityRoi: () => Promise<CityRoiStat[]>
  }
  scraper: {
    start: (config: ScrapeJobConfig) => Promise<string>
    cancel: (jobId: string) => Promise<void>
    pause: (jobId: string) => Promise<void>
    resume: (jobId: string) => Promise<void>
    delete: (jobId: string) => Promise<void>
    deleteBatch: (jobIds: string[]) => Promise<void>
    getJobs: (pagination?: PaginationParams) => Promise<PaginatedResponse<ScrapeJob>>
    onProgress: (cb: (event: ScrapeProgressEvent) => void) => () => void
  }
  ai: {
    scoreSite: (leadId: number, model?: string) => Promise<SiteScoreResult>
    draftEmail: (leadId: number, model?: string) => Promise<OutreachDraft>
    testConnection: (params?: Record<string, any>) => Promise<{ ok: boolean; provider: string; model: string; response?: string; error?: string; latencyMs: number }>
  }
  settings: {
    get: () => Promise<AppSettings>
    save: (patch: Partial<AppSettings>) => Promise<void>
  }
  analysis: {
    runLead: (leadId: number) => Promise<AnalysisResult>
    runBatch: (leadIds: number[]) => Promise<void>
    onProgress: (
      cb: (data: { done: number; total: number; leadId: number }) => void
    ) => () => void
  }
  outreach: {
    send: (recordId: number) => Promise<SendResult>
    sendBatch: () => Promise<{ sent: number; failed: number }>
    getAll: (status?: string, pagination?: PaginationParams) => Promise<PaginatedResponse<OutreachRecord>>
    markReplied: (outreachId: number) => Promise<void>
    markBounced: (outreachId: number) => Promise<void>
    getPendingQueue: () => Promise<any[]>
    scheduleSeq: (
      input: unknown,
      businessName: string
    ) => Promise<OutreachRecord[]>
    getSequences: (pagination?: PaginationParams) => Promise<PaginatedResponse<SequenceSummary>>
    exportCsv: () => Promise<string | null>
    getChartData: () => Promise<{ weekly: any[]; funnel: any[] }>
    smtp: {
      verify: () => Promise<{ ok: boolean; error?: string }>
      reinit: () => Promise<void>
    }
  }
  bulk: {
    analyze: (leadIds: number[]) => Promise<void>
    score: (leadIds: number[]) => Promise<void>
    approve: (leadIds: number[]) => Promise<void>
    scheduleSequences: (leadIds: number[], templateId?: number) => Promise<void>
  }
  notes: {
    get: (leadId: number) => Promise<NoteRecord | null>
    save: (leadId: number, body: string) => Promise<NoteRecord>
  }
  activity: {
    get: (leadId: number) => Promise<ActivityRecord[]>
    getRecent: () => Promise<(ActivityRecord & { business_name: string })[]>
  }
  scheduler: {
    status: () => Promise<boolean>
  }
  emailFinder: {
    run: (leadId: number) => Promise<string | null>
    runBatch: (leadIds: number[]) => Promise<void>
    onProgress: (
      cb: (data: { done: number; total: number; leadId: number }) => void
    ) => () => void
  }
  emailVerifier: {
    runBatch: (leadIds: number[]) => Promise<void>
    onProgress: (
      cb: (data: { done: number; total: number; leadId: number }) => void
    ) => () => void
  }
  templates: {
    getAll: () => Promise<EmailTemplate[]>
    create: (data: Partial<EmailTemplate>) => Promise<EmailTemplate>
    update: (id: number, data: Partial<EmailTemplate>) => Promise<EmailTemplate>
    delete: (id: number) => Promise<void>
  }
  emailAccounts: {
    getAll: () => Promise<EmailAccount[]>
    add: (data: EmailAccountInsert) => Promise<EmailAccount>
    update: (id: number, data: Partial<EmailAccountInsert>) => Promise<void>
    delete: (id: number) => Promise<void>
    test: (id: number) => Promise<{ ok: boolean; error?: string }>
  }
  auth: {
    login: (args: { email: string; password: string }) => Promise<any>
    register: (args: { email: string; password: string }) => Promise<any>
    restoreSession: (args: { userId: number }) => Promise<{ success: boolean; error?: string }>
  }
  users: {
    list: () => Promise<any>
    add: (args: { email: string; password: string; role?: string; name?: string }) => Promise<any>
    updatePermissions: (userId: number, permissions: string[]) => Promise<any>
    updateRole: (userId: number, role: string) => Promise<any>
    delete: (userId: number) => Promise<any>
  }
  pipelines: {
    list: () => Promise<{ pipelines: PipelineDefinition[] }>
    get: (id: string) => Promise<PipelineDefinition>
    create: (data: Partial<PipelineDefinition>) => Promise<PipelineDefinition>
    update: (id: string, data: Partial<PipelineDefinition>) => Promise<PipelineDefinition>
    delete: (id: string) => Promise<void>
    duplicate: (id: string) => Promise<PipelineDefinition>
    run: (id: string, input: Record<string, unknown>, target?: string) => Promise<{ runId: string; status: string; execution_target?: string; workerId?: string; workerName?: string }>
    replay: (pipelineId: string, runId: string, fromNodeId: string) => Promise<{ runId: string; status: string; replayOf: string; fromNodeId: string }>
    getRun: (runId: string) => Promise<PipelineRun>
    listRuns: (pipelineId: string) => Promise<{ runs: PipelineRun[] }>
    cancelRun: (runId: string) => Promise<void>
    nodeTypes: () => Promise<{ types: NodeTypeDescriptor[] }>
    collections: () => Promise<{ collections: CollectionDefinition[] }>
    templates: () => Promise<{ templates: any[] }>
    instantiateTemplate: (templateId: string) => Promise<PipelineDefinition>
  }
  collections: {
    list: () => Promise<{ collections: Array<{ name: string; label: string; totalRecords: number; lastUpdated: string | null; isSystem: boolean }> }>
    get: (name: string, params?: { page?: number; limit?: number; search?: string; sortBy?: string; sortDir?: 'ASC' | 'DESC' }) => Promise<{
      collection: string
      total: number
      page: number
      limit: number
      totalPages: number
      columns: Array<{ key: string; label: string; type: string }>
      records: Array<Record<string, unknown>>
    }>
    update: (name: string, id: string, body: Record<string, unknown>) => Promise<{ success: boolean; record: Record<string, unknown> }>
    delete: (name: string, id: string) => Promise<{ success: boolean }>
    export: (name: string, format?: 'csv' | 'json') => Promise<Blob | string>
  }
  analytics: {
    getRoi: () => Promise<{
      funnel: Array<{ name: string; key: string; count: number; percentage: number; dropoffRate: number; color: string }>
      metrics: {
        totalLeads: number
        qualifiedRate: number
        emailDiscoveryRate: number
        outreachSent: number
        openRate: number
        replyRate: number
        pipelineRunsTotal: number
        pipelineSuccessRate: number
      }
      topCategories: Array<{ category: string; total: number; qualified: number; emailFound: number }>
      topCities: Array<{ city: string; total: number; qualified: number; emailFound: number }>
      sources: Array<{ source: string; total: number; percentage: number }>
    }>
  }
  approvals: {
    list: (status?: string) => Promise<{ approvals: ApprovalSummary[]; pendingCount: number }>
    get: (id: string) => Promise<ApprovalDetail>
    action: (id: string, action: 'approve' | 'reject', modifiedRecords?: any[], reviewerNotes?: string) => Promise<{ success: boolean; status: string }>
  }
  aiConnections: {
    list: () => Promise<{ data: AIConnectionProfile[] }>
    get: (id: string) => Promise<{ data: AIConnectionProfile }>
    create: (data: Partial<AIConnectionProfile>) => Promise<{ data: AIConnectionProfile }>
    update: (id: string, data: Partial<AIConnectionProfile>) => Promise<{ data: AIConnectionProfile }>
    delete: (id: string) => Promise<{ ok: boolean }>
    setDefault: (id: string) => Promise<{ ok: boolean; data: AIConnectionProfile }>
    test: (id: string) => Promise<{ ok: boolean; name: string; provider: string; model: string; response?: string; error?: string; latencyMs: number }>
  }
  customNodes: {
    list: () => Promise<{ data: CustomNode[] }>
    get: (id: string) => Promise<{ data: CustomNode }>
    create: (data: Partial<CustomNode>) => Promise<{ data: CustomNode }>
    update: (id: string, data: Partial<CustomNode>) => Promise<{ data: CustomNode }>
    delete: (id: string) => Promise<{ ok: boolean }>
    test: (id: string, args: { input?: any; config?: any }) => Promise<{ ok: boolean; nodeName?: string; durationMs: number; emitted?: any[]; logs?: any[]; error?: string }>
  }
  workers: {
    list: () => Promise<{ workers: WorkerNodeSummary[]; summary: WorkerFarmSummary }>
    generateToken: () => Promise<{ token: string; org_id: number }>
    delete: (id: string) => Promise<{ success: boolean }>
    dispatch: (args: { runId: string; pipeline: any; input?: Record<string, unknown>; targetWorkerId?: string }) => Promise<any>
    getLocalStatus: () => Promise<any>
    saveLocalConfig: (config: any) => Promise<any>
    connectLocal: () => Promise<any>
    disconnectLocal: () => Promise<any>
  }
  server: {
    getConfig: () => Promise<{ serverUrl: string; autoStartLocal: boolean; isRemote: boolean; isLocalRunning: boolean; port: number }>
    saveConfig: (config: { serverUrl: string; autoStartLocal?: boolean }) => Promise<{ success: boolean; serverUrl: string }>
    testConnection: (url?: string) => Promise<{ ok: boolean; status?: number; latencyMs: number; error?: string; serverInfo?: any }>
    restartLocal: () => Promise<{ success: boolean; port: number }>
  }
  suppression: {
    getAll: (pagination?: { page?: number; pageSize?: number; search?: string }) => Promise<{ data: any[]; total: number }>
    add: (payload: { value: string; type?: 'email' | 'domain' | 'phone'; reason?: string }) => Promise<any>
    batchAdd: (values: string[], type?: 'email' | 'domain' | 'phone', reason?: string) => Promise<{ added: number; skipped: number }>
    remove: (id: number) => Promise<boolean>
    check: (query: string) => Promise<boolean>
  }
}

export interface WorkerNodeSummary {
  id: string
  name: string
  platform: string
  status: 'online' | 'busy' | 'idle' | 'offline'
  capabilities: string[]
  max_concurrency: number
  active_jobs: number
  ip_address: string | null
  version: string | null
  last_heartbeat_at: string | null
  created_at: string
}

export interface WorkerFarmSummary {
  total: number
  online: number
  busy: number
  idle: number
}

export interface ApprovalSummary {
  id: string
  pipelineId: string
  runId: string
  nodeId: string
  nodeLabel: string
  recordCount: number
  sampleRecords: any[]
  records: any[]
  modifiedRecords: any[] | null
  status: 'pending' | 'approved' | 'rejected' | 'timeout'
  reviewerNotes: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
}

export interface ApprovalDetail extends ApprovalSummary {}

export interface AIConnectionProfile {
  id: string
  org_id: number
  name: string
  provider: 'openrouter' | 'openai' | 'groq' | 'gemini' | 'anthropic' | 'lmstudio' | 'ollama' | 'custom_openai' | 'custom_claude'
  base_url: string | null
  api_key: string | null
  default_model: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface CustomNode {
  id: string
  org_id: number
  name: string
  node_key: string | null
  description: string | null
  category: string
  icon: string
  color: string
  code: string
  config_schema: string
  inputs: string
  outputs: string
  enabled: boolean
  created_by: number | null
  created_at: string
  updated_at: string
}

export type ApiClient = IApiService

