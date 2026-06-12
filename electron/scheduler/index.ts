// electron/scheduler/index.ts
import * as cron from 'node-cron'
import { getSettings } from '../../src/db/queries/settings.queries'
import { processDueOutreach } from '../outreach'
import { BrowserWindow } from 'electron'

let activeTask: cron.ScheduledTask | null = null

export async function initScheduler(mainWindow: BrowserWindow): Promise<void> {
  const settings = await getSettings()

  if (activeTask) {
    activeTask.stop()
    activeTask = null
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
}

export function getSchedulerStatus(): boolean {
  return activeTask !== null
}
