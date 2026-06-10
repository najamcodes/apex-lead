// electron/ipc/scraper.ipc.ts
import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../src/types'
import { startScrapeJob, cancelScrapeJob } from '../scraper'
import { getAllScrapeJobs } from '../../src/db/queries/scrape-jobs.queries'
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

  ipcMain.handle(IPC.SCRAPER_CANCEL, (_event, jobId: string) => {
    cancelScrapeJob(jobId)
  })

  ipcMain.handle(IPC.SCRAPER_GET_JOBS, () => getAllScrapeJobs())
}
