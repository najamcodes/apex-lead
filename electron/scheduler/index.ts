// electron/scheduler/index.ts
import * as cron from 'node-cron'
import { getSettings } from '../../src/db/queries/settings.queries'
import { processDueOutreach } from '../outreach'
import { listenForImapReplies } from '../outreach/imap-listener'
import { runWarmupCycle } from '../outreach/warmup-engine'
import { BrowserWindow } from 'electron'

let activeTask: cron.ScheduledTask | null = null
let imapTask: cron.ScheduledTask | null = null
let warmupTask: cron.ScheduledTask | null = null

export async function initScheduler(mainWindow: BrowserWindow): Promise<void> {
  const settings = await getSettings()

  if (activeTask) {
    activeTask.stop()
    activeTask = null
  }
  if (imapTask) {
    imapTask.stop()
    imapTask = null
  }
  if (warmupTask) {
    warmupTask.stop()
    warmupTask = null
  }

  if (settings.auto_send_enabled && settings.auto_send_cron) {
    // Validate cron expression
    if (cron.validate(settings.auto_send_cron)) {
      activeTask = cron.schedule(settings.auto_send_cron, async () => {
        try {
          console.log('[Scheduler] Running auto-send cron job...')
          const result = await processDueOutreach()
          console.log(`[Scheduler] Sent ${result.sent}, failed ${result.failed}`)

          // Optionally notify the UI if we want to show a toast
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('scheduler:completed', result)
          }
        } catch (err) {
          console.error('[Scheduler] Error processing due outreach:', err)
        }
      })
      console.log(`[Scheduler] Initialized with cron: ${settings.auto_send_cron}`)
    } else {
      console.error('[Scheduler] Invalid cron expression:', settings.auto_send_cron)
    }
  } else {
    console.log('[Scheduler] Disabled.')
  }

  // Always run IMAP listener every 5 minutes if auto-send is running or independently? 
  // Let's run it every 5 minutes regardless if the app is open.
  if (cron.validate(settings.imap_cron || '*/5 * * * *')) {
    imapTask = cron.schedule(settings.imap_cron || '*/5 * * * *', async () => {
      try {
        console.log('[Scheduler] Running IMAP listener...')
        await listenForImapReplies()
      } catch (err) {
        console.error('[Scheduler] Error running IMAP listener:', err)
      }
    })
  }

  if (cron.validate(settings.warmup_cron || '*/30 * * * *')) {
    warmupTask = cron.schedule(settings.warmup_cron || '*/30 * * * *', async () => {
      try {
        console.log('[Scheduler] Running Warmup Cycle...')
        await runWarmupCycle()
      } catch (err) {
        console.error('[Scheduler] Error running Warmup:', err)
      }
    })
  }
}

export function getSchedulerStatus(): boolean {
  return activeTask !== null
}
