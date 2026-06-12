// electron/ipc/scraper.ipc.ts
import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../src/types'
import { startScrapeJob, cancelScrapeJob, pauseScrapeJob, resumeScrapeJob } from '../scraper'
import { getAllScrapeJobs, deleteScrapeJob, deleteScrapeJobs } from '../../src/db/queries/scrape-jobs.queries'
import type { ScrapeJobConfig } from '../../src/types/scraper.types'

export function registerScraperIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle(IPC.SCRAPER_START, async (_event, config: ScrapeJobConfig) => {
    const jobId = await startScrapeJob(config, (progressEvent) => {
      // Push progress to renderer — one-way event
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.SCRAPER_PROGRESS, progressEvent)
      }
    })
    return jobId
  })

  ipcMain.handle(IPC.SCRAPER_CANCEL, async (_event, jobId: string) => {
    await cancelScrapeJob(jobId)
  })

  ipcMain.handle(IPC.SCRAPER_PAUSE, async (_event, jobId: string) => {
    pauseScrapeJob(jobId)
  })

  ipcMain.handle(IPC.SCRAPER_RESUME, async (_event, jobId: string) => {
    resumeScrapeJob(jobId)
  })

  ipcMain.handle(IPC.SCRAPER_DELETE, async (_event, jobId: string) => {
    await deleteScrapeJob(jobId)
  })

  ipcMain.handle(IPC.SCRAPER_DELETE_BATCH, async (_event, jobIds: string[]) => {
    await deleteScrapeJobs(jobIds)
  })

  ipcMain.handle(IPC.SCRAPER_GET_JOBS, (_event, pagination?: import('../../src/types').PaginationParams) => {
    return getAllScrapeJobs(pagination)
  })
}
