// electron/window.d.ts
import type {
  PaginatedResponse,
  PaginationParams,
  Lead,
  DashboardStats,
  CityRoiStat,
  ScrapeJobConfig,
  ScrapeJob,
  ScrapeProgressEvent,
  SiteScoreResult,
  OutreachDraft,
  AppSettings,
  AnalysisResult,
  SendResult,
  OutreachRecord,
  SequenceSummary,
  NoteRecord,
  ActivityRecord,
  EmailTemplate,
  ScrapeTarget,
  ScrapeTargetInsert,
  DigestRun,
  QueryProfile,
  QueryProfileInsert,
  EmailAccount,
  EmailAccountInsert
} from '@sdk/core/types'

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>
      }
    }
    api: {
      leads: {
        getAll: (filters?: unknown) => Promise<PaginatedResponse<Lead>>
        getById: (id: number) => Promise<Lead | null>
        insert: (data: unknown) => Promise<Lead>
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
        getRecent: () => Promise<
          (ActivityRecord & { business_name: string })[]
        >
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
        login: (args: any) => Promise<any>
        register: (args: any) => Promise<any>
        restoreSession: (args: { userId: number }) => Promise<{ success: boolean; error?: string }>
      }
      users: {
        list: () => Promise<any>
        add: (args: any) => Promise<any>
        updatePermissions: (userId: number, permissions: string[]) => Promise<any>
        delete: (userId: number) => Promise<any>
      }
      plugins: {
        getAll: () => Promise<any[]>
        get: (id: string) => Promise<any>
        toggle: (id: string, enabled: boolean) => Promise<any>
        setConfig: (id: string, config: Record<string, any>) => Promise<any>
        test: (id: string) => Promise<any>
      }
      workers: {
        getStatus: () => Promise<{ connected: boolean }>
        saveConfig: (config: any) => Promise<any>
        connect: () => Promise<any>
        disconnect: () => Promise<any>
      }
      decision: {
        getCatalog: () => Promise<any>
        getInstalled: () => Promise<any>
        downloadModel: (modelId: string) => Promise<any>
        cancelDownload: (modelId: string) => Promise<any>
        deleteModel: (modelId: string) => Promise<any>
        testInference: (params: any) => Promise<any>
        testCascade: (params: any) => Promise<any>
        getTelemetry: () => Promise<any>
        resetTelemetry: () => Promise<any>
        onDownloadProgress: (cb: (progress: any) => void) => () => void
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
  }
}

export {}
