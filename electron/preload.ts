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
    delete: (id: number) => ipcRenderer.invoke(IPC.LEADS_DELETE, id),
  },
  stats: {
    getDashboard: () => ipcRenderer.invoke(IPC.STATS_GET_DASHBOARD),
  },
  scraper: {
    start:    (config: unknown) => ipcRenderer.invoke(IPC.SCRAPER_START, config),
    cancel:   (jobId: string)   => ipcRenderer.invoke(IPC.SCRAPER_CANCEL, jobId),
    getJobs:  ()                => ipcRenderer.invoke(IPC.SCRAPER_GET_JOBS),
    onProgress: (cb: (event: any) => void) => {
      const listener = (_event: any, data: any) => cb(data)
      ipcRenderer.on(IPC.SCRAPER_PROGRESS, listener)
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(IPC.SCRAPER_PROGRESS, listener)
      }
    },
  },
  ai: {
    scoreSite:   (leadId: number, model?: string) => ipcRenderer.invoke(IPC.AI_SCORE_SITE, leadId, model),
    draftEmail:  (leadId: number, model?: string) => ipcRenderer.invoke(IPC.AI_DRAFT_EMAIL, leadId, model),
  },
  settings: {
    get:  ()               => ipcRenderer.invoke(IPC.SETTINGS_GET),
    save: (patch: unknown) => ipcRenderer.invoke(IPC.SETTINGS_SAVE, patch),
  },
  analysis: {
    runLead:  (leadId: number) => ipcRenderer.invoke(IPC.ANALYSIS_RUN_LEAD, leadId),
    runBatch: (leadIds: number[]) => ipcRenderer.invoke(IPC.ANALYSIS_RUN_BATCH, leadIds),
    onProgress: (callback: (data: { done: number; total: number; stage: string }) => void) => {
      const handler = (_event: any, data: any) => callback(data)
      ipcRenderer.on(IPC.ANALYSIS_PROGRESS, handler)
      return () => { ipcRenderer.removeListener(IPC.ANALYSIS_PROGRESS, handler) }
    }
  },
  outreach: {
    send:            (recordId: number)                          => ipcRenderer.invoke(IPC.OUTREACH_SEND, recordId),
    sendBatch:       ()                                          => ipcRenderer.invoke(IPC.OUTREACH_SEND_BATCH),
    getAll:          (status?: string)                           => ipcRenderer.invoke(IPC.OUTREACH_GET_ALL, status),
    markReplied:     (outreachId: number)                        => ipcRenderer.invoke(IPC.OUTREACH_MARK_REPLIED, outreachId),
    markBounced:     (outreachId: number)                        => ipcRenderer.invoke(IPC.OUTREACH_MARK_BOUNCED, outreachId),
    scheduleSeq:     (input: unknown, businessName: string)      => ipcRenderer.invoke(IPC.OUTREACH_SCHEDULE_SEQ, input, businessName),
    getSequences:    ()                                          => ipcRenderer.invoke(IPC.OUTREACH_GET_SEQUENCES),
    exportCsv:       ()                                          => ipcRenderer.invoke(IPC.OUTREACH_EXPORT_CSV),
    getChartData:    ()                                          => ipcRenderer.invoke(IPC.STATS_GET_CHART_DATA),
    smtp: {
      verify:  () => ipcRenderer.invoke('smtp:verify'),
      reinit:  () => ipcRenderer.invoke('smtp:reinit'),
    },
  },
  bulk: {
    analyze:  (leadIds: number[]) => ipcRenderer.invoke(IPC.BULK_ANALYZE, leadIds),
    score:    (leadIds: number[]) => ipcRenderer.invoke(IPC.BULK_SCORE, leadIds),
    approve:  (leadIds: number[]) => ipcRenderer.invoke(IPC.BULK_APPROVE, leadIds),
    scheduleSequences: (leadIds: number[], templateId: number) => ipcRenderer.invoke(IPC.BULK_SCHEDULE_SEQUENCES, leadIds, templateId),
  },
  notes: {
    get:   (leadId: number)               => ipcRenderer.invoke(IPC.NOTES_GET, leadId),
    save:  (leadId: number, body: string) => ipcRenderer.invoke(IPC.NOTES_SAVE, leadId, body),
  },
  activity: {
    get:   (leadId: number) => ipcRenderer.invoke(IPC.ACTIVITY_GET, leadId),
    getRecent: () => ipcRenderer.invoke(IPC.ACTIVITY_GET_RECENT),
  },
  scheduler: {
    status: () => ipcRenderer.invoke(IPC.SCHEDULER_STATUS),
  },
  emailFinder: {
    run:      (leadId: number)      => ipcRenderer.invoke(IPC.EMAIL_FINDER_RUN, leadId),
    runBatch: (leadIds: number[])   => ipcRenderer.invoke(IPC.EMAIL_FINDER_RUN_BATCH, leadIds),
    onProgress: (callback: (data: { done: number; total: number; leadId: number }) => void) => {
      const handler = (_event: any, data: any) => callback(data)
      ipcRenderer.on('emailFinder:progress', handler)
      return () => { ipcRenderer.removeListener('emailFinder:progress', handler) }
    }
  }
})
