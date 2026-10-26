// electron/ipc/scraper.ipc.ts
import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/types'
import { startPipelineJob, cancelPipelineJob, pausePipelineJob, resumePipelineJob } from '@sdk/core/pipelines'
import { getAllScrapeJobs, deleteScrapeJob, deleteScrapeJobs } from '../../backend/db/queries/scrape-jobs.queries'
import type { ScrapeJobConfig } from '../../shared/types/scraper.types'
import { requirePermission } from '../../backend/db/queries/tenant'

export function registerScraperIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle(IPC.SCRAPER_START, async (_event, config: ScrapeJobConfig) => {
    requirePermission('run_scraper')
    const jobId = await startPipelineJob('lead-generation', config, (progressEvent) => {
      // Push progress to renderer — one-way event
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.SCRAPER_PROGRESS, progressEvent)
      }
    })
    return jobId
  })

  ipcMain.handle(IPC.SCRAPER_CANCEL, async (_event, jobId: string) => {
    requirePermission('run_scraper')
    await cancelPipelineJob(jobId)
  })

  ipcMain.handle(IPC.SCRAPER_PAUSE, async (_event, jobId: string) => {
    requirePermission('run_scraper')
    pausePipelineJob(jobId)
  })

  ipcMain.handle(IPC.SCRAPER_RESUME, async (_event, jobId: string) => {
    requirePermission('run_scraper')
    resumePipelineJob(jobId)
  })

  ipcMain.handle(IPC.SCRAPER_DELETE, async (_event, jobId: string) => {
    requirePermission('run_scraper')
    await deleteScrapeJob(jobId)
  })

  ipcMain.handle(IPC.SCRAPER_DELETE_BATCH, async (_event, jobIds: string[]) => {
    requirePermission('run_scraper')
    await deleteScrapeJobs(jobIds)
  })

  ipcMain.handle(IPC.SCRAPER_GET_JOBS, (_event, pagination?: import('../../shared/types').PaginationParams) => {
    return getAllScrapeJobs(pagination)
  })
}

