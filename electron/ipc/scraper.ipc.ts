// electron/ipc/scraper.ipc.ts
import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../src/types'
import { startScrapeJob, cancelScrapeJob, pauseScrapeJob, resumeScrapeJob } from '../scraper'
import { getAllScrapeJobs, deleteScrapeJob, deleteScrapeJobs } from '../../src/db/queries/scrape-jobs.queries'
import type { ScrapeJobConfig } from '../../src/types/scraper.types'
import { getCurrentUserRole, getCurrentUserPermissions } from '../../src/db/queries/tenant'

function requirePermission(perm: string) {
  if (getCurrentUserRole() === 'admin') return;
  const perms = getCurrentUserPermissions();
  if (!perms.includes(perm)) {
    throw new Error(`Unauthorized: Missing permission ${perm}`);
  }
}

export function registerScraperIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle(IPC.SCRAPER_START, async (_event, config: ScrapeJobConfig) => {
    requirePermission('run_scraper')
    const jobId = await startScrapeJob(config, (progressEvent) => {
      // Push progress to renderer — one-way event
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.SCRAPER_PROGRESS, progressEvent)
      }
    })
    return jobId
  })

  ipcMain.handle(IPC.SCRAPER_CANCEL, async (_event, jobId: string) => {
    requirePermission('run_scraper')
    await cancelScrapeJob(jobId)
  })

  ipcMain.handle(IPC.SCRAPER_PAUSE, async (_event, jobId: string) => {
    requirePermission('run_scraper')
    pauseScrapeJob(jobId)
  })

  ipcMain.handle(IPC.SCRAPER_RESUME, async (_event, jobId: string) => {
    requirePermission('run_scraper')
    resumeScrapeJob(jobId)
  })

  ipcMain.handle(IPC.SCRAPER_DELETE, async (_event, jobId: string) => {
    requirePermission('run_scraper')
    await deleteScrapeJob(jobId)
  })

  ipcMain.handle(IPC.SCRAPER_DELETE_BATCH, async (_event, jobIds: string[]) => {
    requirePermission('run_scraper')
    await deleteScrapeJobs(jobIds)
  })

  ipcMain.handle(IPC.SCRAPER_GET_JOBS, (_event, pagination?: import('../../src/types').PaginationParams) => {
    return getAllScrapeJobs(pagination)
  })
}
