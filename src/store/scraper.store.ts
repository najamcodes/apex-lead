// src/store/scraper.store.ts
import { create } from 'zustand'
import type { ScrapeJob, ScrapeJobConfig, ScrapeProgressEvent } from '../types/scraper.types'

interface ScraperState {
  jobs: ScrapeJob[]
  page: number
  pageSize: number
  total: number
  activeJobId: string | null
  progress: ScrapeProgressEvent | null
  loading: boolean
  
  // CSV Batch state
  csvQueue: ScrapeJobConfig[]
  csvIndex: number
  csvFilename: string | null

  // Actions
  setPagination: (page: number, pageSize?: number) => void
  fetchJobs: () => Promise<void>
  startJob: (config: ScrapeJobConfig) => Promise<void>
  cancelJob: (jobId: string) => Promise<void>
  pauseJob: (jobId: string) => Promise<void>
  resumeJob: (jobId: string) => Promise<void>
  deleteJob: (jobId: string) => Promise<void>
  deleteJobs: (jobIds: string[]) => Promise<void>
  setProgress: (event: ScrapeProgressEvent) => void
  
  // CSV Actions
  startCsvQueue: (filename: string, queue: ScrapeJobConfig[]) => Promise<void>
  cancelCsvQueue: () => void
}

export const useScraperStore = create<ScraperState>((set, get) => ({
  jobs: [],
  page: 1,
  pageSize: 50,
  total: 0,
  activeJobId: null,
  progress: null,
  loading: false,

  csvQueue: [],
  csvIndex: 0,
  csvFilename: null,

  setPagination: (page, pageSize) => {
    set({ page, pageSize: pageSize || get().pageSize })
    get().fetchJobs()
  },

  fetchJobs: async () => {
    const { data, total } = await window.api.scraper.getJobs({ page: get().page, pageSize: get().pageSize })
    set({ jobs: data, total })
  },

  startJob: async (config) => {
    set({ loading: true })
    const jobId = await window.api.scraper.start(config)
    set({ activeJobId: jobId, loading: false })
    await get().fetchJobs()
  },

  cancelJob: async (jobId) => {
    await window.api.scraper.cancel(jobId)
    set({ activeJobId: null, progress: null })
    await get().fetchJobs()
  },

  pauseJob: async (jobId) => {
    await window.api.scraper.pause(jobId)
    await get().fetchJobs()
  },

  resumeJob: async (jobId) => {
    await window.api.scraper.resume(jobId)
    await get().fetchJobs()
  },

  deleteJob: async (jobId) => {
    await window.api.scraper.delete(jobId)
    await get().fetchJobs()
  },

  deleteJobs: async (jobIds) => {
    await window.api.scraper.deleteBatch(jobIds)
    await get().fetchJobs()
  },

  setProgress: (event) => {
    set({ progress: event })
    if (event.status === 'completed' || event.status === 'failed' || event.status === 'cancelled') {
      set({ activeJobId: null })
      get().fetchJobs()

      // Handle CSV Queue progression
      const { csvQueue, csvIndex, startJob } = get()
      if (csvQueue.length > 0 && event.status !== 'cancelled') {
        const nextIndex = csvIndex + 1
        if (nextIndex < csvQueue.length) {
          set({ csvIndex: nextIndex })
          startJob(csvQueue[nextIndex])
        } else {
          // Finished entire queue
          set({ csvQueue: [], csvIndex: 0, csvFilename: null })
        }
      } else if (event.status === 'cancelled') {
        // If the user cancelled a job, abort the entire queue
        set({ csvQueue: [], csvIndex: 0, csvFilename: null })
      }
    }
  },

  startCsvQueue: async (filename, queue) => {
    if (queue.length === 0) return
    set({ csvFilename: filename, csvQueue: queue, csvIndex: 0 })
    await get().startJob(queue[0])
  },

  cancelCsvQueue: () => {
    const { activeJobId, cancelJob } = get()
    if (activeJobId) {
      // Cancelling the active job will also clear the queue in setProgress
      cancelJob(activeJobId)
    } else {
      set({ csvQueue: [], csvIndex: 0, csvFilename: null })
    }
  }
}))
