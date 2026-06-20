// src/types/window.d.ts
interface Window {
  electron: {
    ipcRenderer: {
      invoke(channel: string, ...args: any[]): Promise<any>;
    };
  };
  api: {
    leads: {
      getAll: (filters?: unknown) => Promise<import('./index').PaginatedResponse<import('./index').Lead>>
      getById: (id: number) => Promise<import('./index').Lead | null>
      insert: (data: unknown) => Promise<import('./index').Lead>
      updateStatus: (id: number, status: string, notes?: string) => Promise<void>
      delete: (id: number) => Promise<void>
    }
    stats: {
      getDashboard: () => Promise<import('./index').DashboardStats>
      getCityRoi: () => Promise<import('./index').CityRoiStat[]>
    }
    scraper: {
      start: (config: import('./scraper.types').ScrapeJobConfig) => Promise<string>
      cancel: (jobId: string) => Promise<void>
      pause: (jobId: string) => Promise<void>
      resume: (jobId: string) => Promise<void>
      delete: (jobId: string) => Promise<void>
      deleteBatch: (jobIds: string[]) => Promise<void>
      getJobs: (pagination?: import('./index').PaginationParams) => Promise<import('./index').PaginatedResponse<import('./scraper.types').ScrapeJob>>
      onProgress: (cb: (event: import('./scraper.types').ScrapeProgressEvent) => void) => () => void
    }
    ai: {
      scoreSite: (leadId: number, model?: string) => Promise<import('./ai.types').SiteScoreResult>
      draftEmail: (leadId: number, model?: string) => Promise<import('./ai.types').OutreachDraft>
    }
    settings: {
      get: () => Promise<import('./index').AppSettings>
      save: (patch: Partial<import('./index').AppSettings>) => Promise<void>
    }
    analysis: {
      runLead: (leadId: number) => Promise<import('./analysis.types').AnalysisResult>
      runBatch: (leadIds: number[]) => Promise<void>
      onProgress: (
        cb: (data: { done: number; total: number; leadId: number }) => void
      ) => () => void
    }
    outreach: {
      send: (recordId: number) => Promise<import('./outreach.types').SendResult>
      sendBatch: () => Promise<{ sent: number; failed: number }>
      getAll: (status?: string, pagination?: import('./index').PaginationParams) => Promise<import('./index').PaginatedResponse<import('./outreach.types').OutreachRecord>>
      markReplied: (outreachId: number) => Promise<void>
      markBounced: (outreachId: number) => Promise<void>
      getPendingQueue: () => Promise<any[]>
      scheduleSeq: (
        input: unknown,
        businessName: string
      ) => Promise<import('./outreach.types').OutreachRecord[]>
      getSequences: (pagination?: import('./index').PaginationParams) => Promise<import('./index').PaginatedResponse<import('./outreach.types').SequenceSummary>>
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
      get: (leadId: number) => Promise<import('./activity.types').NoteRecord | null>
      save: (leadId: number, body: string) => Promise<import('./activity.types').NoteRecord>
    }
    activity: {
      get: (leadId: number) => Promise<import('./activity.types').ActivityRecord[]>
      getRecent: () => Promise<
        (import('./activity.types').ActivityRecord & { business_name: string })[]
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
      getAll: () => Promise<import('./index').EmailTemplate[]>
      create: (data: Partial<import('./index').EmailTemplate>) => Promise<import('./index').EmailTemplate>
      update: (id: number, data: Partial<import('./index').EmailTemplate>) => Promise<import('./index').EmailTemplate>
      delete: (id: number) => Promise<void>
    }
    pipeline: {
      getTargets: () => Promise<import('./pipeline.types').ScrapeTarget[]>
      addTarget: (data: import('./pipeline.types').ScrapeTargetInsert) => Promise<import('./pipeline.types').ScrapeTarget>
      updateTarget: (id: number, patch: Partial<import('./pipeline.types').ScrapeTarget>) => Promise<void>
      toggleTarget: (id: number) => Promise<void>
      deleteTarget: (id: number) => Promise<void>
      getDigests: () => Promise<import('./pipeline.types').DigestRun[]>
      getStatus: () => Promise<any>
      runNow: () => Promise<any>
      sendDigestNow: () => Promise<void>
      restartRunner: () => Promise<void>
      onLog: (cb: (msg: string) => void) => () => void
    }
    queryProfiles: {
      getAll: () => Promise<import('./pipeline.types').QueryProfile[]>
      getActive: () => Promise<import('./pipeline.types').QueryProfile[]>
      insert: (data: import('./pipeline.types').QueryProfileInsert) => Promise<import('./pipeline.types').QueryProfile>
      updateStatus: (id: number, status: 'active' | 'paused' | 'error') => Promise<boolean>
      delete: (id: number) => Promise<boolean>
    }
    emailAccounts: {
      getAll: () => Promise<import('./index').EmailAccount[]>
      add: (data: import('./index').EmailAccountInsert) => Promise<import('./index').EmailAccount>
      update: (id: number, data: Partial<import('./index').EmailAccountInsert>) => Promise<void>
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
  }
}
