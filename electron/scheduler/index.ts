// electron/scheduler/index.ts
import * as cron from 'node-cron'
import { getDataSource } from '../../src/db'
import { UserEntity } from '../../src/db/entities/UserEntity'
import { getSettings } from '../../src/db/queries/settings.queries'
import { processDueOutreach } from '../outreach'
import { listenForImapReplies } from '../outreach/imap-listener'
import { runWarmupCycle } from '../outreach/warmup-engine'
import { BrowserWindow } from 'electron'

let activeTasks: cron.ScheduledTask[] = []
let imapTasks: cron.ScheduledTask[] = []
let warmupTasks: cron.ScheduledTask[] = []

export async function initScheduler(mainWindow: BrowserWindow): Promise<void> {
  // Clear old tasks
  activeTasks.forEach(t => t.stop())
  activeTasks = []
  imapTasks.forEach(t => t.stop())
  imapTasks = []
  warmupTasks.forEach(t => t.stop())
  warmupTasks = []

  const users = await getDataSource().getRepository(UserEntity).find()
  const originalUserId = (global as any).currentUserId

  for (const user of users) {
    ;(global as any).currentUserId = user.id
    const settings = await getSettings()

    // Auto-send
    if (settings.auto_send_enabled && settings.auto_send_cron) {
      if (cron.validate(settings.auto_send_cron)) {
        const task = cron.schedule(settings.auto_send_cron, async () => {
          ;(global as any).currentUserId = user.id
          try {
            const result = await processDueOutreach()
            if (result.sent > 0 || result.failed > 0) {
              console.log(`[Scheduler] User ${user.id} sent ${result.sent}, failed ${result.failed}`)
            }

            if ((global as any).currentUserId === user.id && mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('scheduler:completed', result)
            }
          } catch (err) {
            console.error(`[Scheduler] User ${user.id} error processing outreach:`, err)
          }
        })
        activeTasks.push(task)
        console.log(`[Scheduler] User ${user.id} initialized auto-send with cron: ${settings.auto_send_cron}`)
      }
    }

    // IMAP
    if (cron.validate(settings.imap_cron || '*/5 * * * *')) {
      const task = cron.schedule(settings.imap_cron || '*/5 * * * *', async () => {
        ;(global as any).currentUserId = user.id
        try {
          await listenForImapReplies()
        } catch (err) {
          console.error(`[Scheduler] User ${user.id} error running IMAP listener:`, err)
        }
      })
      imapTasks.push(task)
    }

    // Warmup
    if (cron.validate(settings.warmup_cron || '*/30 * * * *')) {
      const task = cron.schedule(settings.warmup_cron || '*/30 * * * *', async () => {
        ;(global as any).currentUserId = user.id
        try {
          await runWarmupCycle()
        } catch (err) {
          console.error(`[Scheduler] User ${user.id} error running Warmup:`, err)
        }
      })
      warmupTasks.push(task)
    }
  }

  // Restore the originally logged-in user
  ;(global as any).currentUserId = originalUserId
}

export function getSchedulerStatus(): boolean {
  return activeTasks.length > 0
}
