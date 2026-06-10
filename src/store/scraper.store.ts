// src/store/scraper.store.ts
import { create } from 'zustand'
import type { ScrapeJob, ScrapeJobConfig, ScrapeProgressEvent } from '../types/scraper.types'

interface ScraperState {
  jobs: ScrapeJob[]
  activeJobId: string | null
  progress: ScrapeProgressEvent | null
  loading: boolean
  // Actions
  fetchJobs: () => Promise<void>
  startJob: (config: ScrapeJobConfig) => Promise<void>
  cancelJob: (jobId: string) => Promise<void>
  setProgress: (event: ScrapeProgressEvent) => void
}

export const useScraperStore = create<ScraperState>((set, get) => ({
  jobs: [],
  activeJobId: null,
  progress: null,
  loading: false,

  fetchJobs: async () => {
    const jobs = await window.api.scraper.getJobs()
    set({ jobs })
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

  setProgress: (event) => {
    set({ progress: event })
    if (event.status === 'completed' || event.status === 'failed' || event.status === 'cancelled') {
      set({ activeJobId: null })
      get().fetchJobs()
    }
  },
}))
