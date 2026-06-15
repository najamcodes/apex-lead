// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../src/types'

contextBridge.exposeInMainWorld('api', {
  leads: {
    getAll: (filters?: unknown) => ipcRenderer.invoke(IPC.LEADS_GET_ALL, filters),
    getById: (id: number) => ipcRenderer.invoke(IPC.LEADS_GET_BY_ID, id),
    insert: (data: unknown) => ipcRenderer.invoke(IPC.LEADS_INSERT, data),
    updateStatus: (id: number, status: string, notes?: string) =>
      ipcRenderer.invoke(IPC.LEADS_UPDATE_STATUS, id, status, notes),
    delete: (id: number) => ipcRenderer.invoke(IPC.LEADS_DELETE, id)
  },
  stats: {
    getDashboard: () => ipcRenderer.invoke(IPC.STATS_GET_DASHBOARD),
    getCityRoi: () => ipcRenderer.invoke(IPC.STATS_GET_CITY_ROI)
  },
  scraper: {
    start: (config: unknown) => ipcRenderer.invoke(IPC.SCRAPER_START, config),
    cancel: (jobId: string) => ipcRenderer.invoke(IPC.SCRAPER_CANCEL, jobId),
    pause: (jobId: string) => ipcRenderer.invoke(IPC.SCRAPER_PAUSE, jobId),
    resume: (jobId: string) => ipcRenderer.invoke(IPC.SCRAPER_RESUME, jobId),
    delete: (jobId: string) => ipcRenderer.invoke(IPC.SCRAPER_DELETE, jobId),
    deleteBatch: (jobIds: string[]) => ipcRenderer.invoke(IPC.SCRAPER_DELETE_BATCH, jobIds),
    getJobs: (pagination?: unknown) => ipcRenderer.invoke(IPC.SCRAPER_GET_JOBS, pagination),
    onProgress: (cb: (event: any) => void) => {
      const listener = (_event: any, data: any) => cb(data)
      ipcRenderer.on(IPC.SCRAPER_PROGRESS, listener)
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(IPC.SCRAPER_PROGRESS, listener)
      }
    }
  },
  ai: {
    scoreSite: (leadId: number, model?: string) =>
      ipcRenderer.invoke(IPC.AI_SCORE_SITE, leadId, model),
    draftEmail: (leadId: number, model?: string) =>
      ipcRenderer.invoke(IPC.AI_DRAFT_EMAIL, leadId, model)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
    save: (patch: unknown) => ipcRenderer.invoke(IPC.SETTINGS_SAVE, patch)
  },
  analysis: {
    runLead: (leadId: number) => ipcRenderer.invoke(IPC.ANALYSIS_RUN_LEAD, leadId),
    runBatch: (leadIds: number[]) => ipcRenderer.invoke(IPC.ANALYSIS_RUN_BATCH, leadIds),
    onProgress: (callback: (data: { done: number; total: number; stage: string }) => void) => {
      const handler = (_event: any, data: any) => callback(data)
      ipcRenderer.on(IPC.ANALYSIS_PROGRESS, handler)
      return () => {
        ipcRenderer.removeListener(IPC.ANALYSIS_PROGRESS, handler)
      }
    }
  },
  outreach: {
    send: (recordId: number) => ipcRenderer.invoke(IPC.OUTREACH_SEND, recordId),
    sendBatch: () => ipcRenderer.invoke(IPC.OUTREACH_SEND_BATCH),
    getAll: (status?: string, pagination?: unknown) => ipcRenderer.invoke(IPC.OUTREACH_GET_ALL, status, pagination),
    markReplied: (outreachId: number) => ipcRenderer.invoke(IPC.OUTREACH_MARK_REPLIED, outreachId),
    markBounced: (outreachId: number) => ipcRenderer.invoke(IPC.OUTREACH_MARK_BOUNCED, outreachId),
    getPendingQueue: () => ipcRenderer.invoke('outreach:getPendingQueue'),
    scheduleSeq: (input: unknown, businessName: string) =>
      ipcRenderer.invoke(IPC.OUTREACH_SCHEDULE_SEQ, input, businessName),
    getSequences: (pagination?: unknown) => ipcRenderer.invoke(IPC.OUTREACH_GET_SEQUENCES, pagination),
    exportCsv: () => ipcRenderer.invoke(IPC.OUTREACH_EXPORT_CSV),
    getChartData: () => ipcRenderer.invoke(IPC.STATS_GET_CHART_DATA),
    smtp: {
      verify: () => ipcRenderer.invoke('smtp:verify'),
      reinit: () => ipcRenderer.invoke('smtp:reinit')
    }
  },
  bulk: {
    analyze: (leadIds: number[]) => ipcRenderer.invoke(IPC.BULK_ANALYZE, leadIds),
    score: (leadIds: number[]) => ipcRenderer.invoke(IPC.BULK_SCORE, leadIds),
    approve: (leadIds: number[]) => ipcRenderer.invoke(IPC.BULK_APPROVE, leadIds),
    scheduleSequences: (leadIds: number[], templateId: number) =>
      ipcRenderer.invoke(IPC.BULK_SCHEDULE_SEQUENCES, leadIds, templateId)
  },
  notes: {
    get: (leadId: number) => ipcRenderer.invoke(IPC.NOTES_GET, leadId),
    save: (leadId: number, body: string) => ipcRenderer.invoke(IPC.NOTES_SAVE, leadId, body)
  },
  activity: {
    get: (leadId: number) => ipcRenderer.invoke(IPC.ACTIVITY_GET, leadId),
    getRecent: () => ipcRenderer.invoke(IPC.ACTIVITY_GET_RECENT)
  },
  scheduler: {
    status: () => ipcRenderer.invoke(IPC.SCHEDULER_STATUS)
  },
  emailFinder: {
    run: (leadId: number) => ipcRenderer.invoke(IPC.EMAIL_FINDER_RUN, leadId),
    runBatch: (leadIds: number[]) => ipcRenderer.invoke(IPC.EMAIL_FINDER_RUN_BATCH, leadIds),
    onProgress: (callback: (data: { done: number; total: number; leadId: number }) => void) => {
      const handler = (_event: any, data: any) => callback(data)
      ipcRenderer.on('emailFinder:progress', handler)
      return () => {
        ipcRenderer.removeListener('emailFinder:progress', handler)
      }
    }
  },
  emailVerifier: {
    runBatch: (leadIds: number[]) => ipcRenderer.invoke(IPC.EMAIL_VERIFIER_RUN_BATCH, leadIds),
    onProgress: (callback: (data: { done: number; total: number; leadId: number }) => void) => {
      const handler = (_event: any, data: any) => callback(data)
      ipcRenderer.on('emailVerifier:progress', handler)
      return () => {
        ipcRenderer.removeListener('emailVerifier:progress', handler)
      }
    }
  },
  templates: {
    getAll: () => ipcRenderer.invoke(IPC.TEMPLATES_GET_ALL),
    create: (data: any) => ipcRenderer.invoke(IPC.TEMPLATES_CREATE, data),
    update: (id: number, data: any) => ipcRenderer.invoke(IPC.TEMPLATES_UPDATE, id, data),
    delete: (id: number) => ipcRenderer.invoke(IPC.TEMPLATES_DELETE, id)
  },
  pipeline: {
    getTargets:     ()             => ipcRenderer.invoke(IPC.TARGETS_GET_ALL),
    addTarget:      (data: unknown) => ipcRenderer.invoke(IPC.TARGETS_INSERT, data),
    updateTarget:   (id: number, patch: unknown) => ipcRenderer.invoke(IPC.TARGETS_UPDATE, id, patch),
    deleteTarget:   (id: number)   => ipcRenderer.invoke(IPC.TARGETS_DELETE, id),
    toggleTarget:   (id: number)   => ipcRenderer.invoke(IPC.TARGETS_TOGGLE, id),
    runNow:         ()             => ipcRenderer.invoke(IPC.PIPELINE_RUN_NOW),
    getStatus:      ()             => ipcRenderer.invoke(IPC.PIPELINE_GET_STATUS),
    getDigests:     ()             => ipcRenderer.invoke(IPC.DIGESTS_GET_ALL),
    sendDigestNow:  ()             => ipcRenderer.invoke('pipeline:sendDigestNow'),
    restartRunner:  ()             => ipcRenderer.invoke('pipeline:restartRunner'),
    onLog: (cb: (msg: string) => void) => {
      const listener = (_e: any, msg: string) => cb(msg)
      ipcRenderer.on('pipeline:log', listener)
      return () => ipcRenderer.removeListener('pipeline:log', listener)
    }
  },
  queryProfiles: {
    getAll:       () => ipcRenderer.invoke('query-profiles:get-all'),
    getActive:    () => ipcRenderer.invoke('query-profiles:get-active'),
    insert:       (data: any) => ipcRenderer.invoke('query-profiles:insert', data),
    updateStatus: (id: number, status: string) => ipcRenderer.invoke('query-profiles:update-status', id, status),
    delete:       (id: number) => ipcRenderer.invoke('query-profiles:delete', id)
  },
  emailAccounts: {
    getAll: () => ipcRenderer.invoke('emailAccounts:getAll'),
    add: (data: any) => ipcRenderer.invoke('emailAccounts:add', data),
    update: (id: number, data: any) => ipcRenderer.invoke('emailAccounts:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('emailAccounts:delete', id),
    test: (id: number) => ipcRenderer.invoke('emailAccounts:test', id)
  },
  auth: {
    login: (args: any) => ipcRenderer.invoke('auth:login', args),
    register: (args: any) => ipcRenderer.invoke('auth:register', args),
    restoreSession: (args: { userId: number }) => ipcRenderer.invoke('auth:restoreSession', args)
  },
  users: {
    list: () => ipcRenderer.invoke(IPC.USERS_LIST),
    add: (args: any) => ipcRenderer.invoke(IPC.USERS_ADD, args),
    updatePermissions: (userId: number, permissions: string[]) => ipcRenderer.invoke(IPC.USERS_UPDATE_PERMISSIONS, { userId, permissions }),
    delete: (userId: number) => ipcRenderer.invoke(IPC.USERS_DELETE, userId)
  }
})
