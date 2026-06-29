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
} from '../../shared/types'
import type { ScrapeJob, ScrapeJobConfig, ScrapeProgressEvent } from '../../shared/types/scraper.types'
import type { SiteScoreResult, OutreachDraft } from '../../shared/types/ai.types'
import type { AnalysisResult } from '../../shared/types/analysis.types'
import type { OutreachRecord, SendResult, SequenceSummary } from '../../shared/types/outreach.types'
import type { ActivityRecord, NoteRecord } from '../../shared/types/activity.types'
import type {
  ScrapeTarget,
  ScrapeTargetInsert,
  DigestRun,
  QueryProfile,
  QueryProfileInsert,
  PipelineDefinition,
  PipelineRun,
  NodeTypeDescriptor,
} from '../../shared/types/pipeline.types'
import type { CollectionDefinition } from '../../shared/types/collection.types'

export interface IApiService {
  leads: {
    getAll: (filters?: LeadFilters) => Promise<PaginatedResponse<Lead>>
    getById: (id: number) => Promise<Lead | null>
    insert: (data: LeadInsert) => Promise<Lead>
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
  pipeline: {
    getTargets: () => Promise<ScrapeTarget[]>
    addTarget: (data: ScrapeTargetInsert) => Promise<ScrapeTarget>
    updateTarget: (id: number, patch: Partial<ScrapeTarget>) => Promise<void>
    toggleTarget: (id: number) => Promise<void>
    deleteTarget: (id: number) => Promise<void>
    getDigests: () => Promise<DigestRun[]>
    getStatus: () => Promise<any>
    runNow: () => Promise<any>
    sendDigestNow: () => Promise<void>
    restartRunner: () => Promise<void>
    onLog: (cb: (msg: string) => void) => () => void
  }
  queryProfiles: {
    getAll: () => Promise<QueryProfile[]>
    getActive: () => Promise<QueryProfile[]>
    insert: (data: QueryProfileInsert) => Promise<QueryProfile>
    updateStatus: (id: number, status: 'active' | 'paused' | 'error') => Promise<boolean>
    delete: (id: number) => Promise<boolean>
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
    add: (args: { email: string; password: string }) => Promise<any>
    updatePermissions: (userId: number, permissions: string[]) => Promise<any>
    delete: (userId: number) => Promise<any>
  }
  pipelines: {
    list: () => Promise<{ pipelines: PipelineDefinition[] }>
    get: (id: string) => Promise<PipelineDefinition>
    create: (data: Partial<PipelineDefinition>) => Promise<PipelineDefinition>
    update: (id: string, data: Partial<PipelineDefinition>) => Promise<PipelineDefinition>
    delete: (id: string) => Promise<void>
    run: (id: string, input: Record<string, unknown>) => Promise<{ runId: string; status: string }>
    getRun: (runId: string) => Promise<PipelineRun>
    listRuns: (pipelineId: string) => Promise<{ runs: PipelineRun[] }>
    cancelRun: (runId: string) => Promise<void>
    nodeTypes: () => Promise<{ types: NodeTypeDescriptor[] }>
    collections: () => Promise<{ collections: CollectionDefinition[] }>
  }
}
