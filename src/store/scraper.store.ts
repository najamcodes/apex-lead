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
  // Actions
  setPagination: (page: number, pageSize?: number) => void
  fetchJobs: () => Promise<void>
  startJob: (config: ScrapeJobConfig) => Promise<void>
  cancelJob: (jobId: string) => Promise<void>
  deleteJob: (jobId: string) => Promise<void>
  setProgress: (event: ScrapeProgressEvent) => void
}

export const useScraperStore = create<ScraperState>((set, get) => ({
  jobs: [],
  page: 1,
  pageSize: 50,
  total: 0,
  activeJobId: null,
  progress: null,
  loading: false,

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

  deleteJob: async (jobId) => {
    await window.api.scraper.delete(jobId)
    await get().fetchJobs()
  },

  setProgress: (event) => {
    set({ progress: event })
    if (event.status === 'completed' || event.status === 'failed' || event.status === 'cancelled') {
      set({ activeJobId: null })
      get().fetchJobs()
    }
  }
}))
