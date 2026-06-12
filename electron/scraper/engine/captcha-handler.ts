// electron/scraper/engine/captcha-handler.ts
// Detects CAPTCHAs and handles them gracefully.
// Supports: pause-and-wait, 2captcha API, proxy rotation on block.

import type { Page } from 'playwright'
import { humanDelay } from '../stealth'

export type CaptchaStrategy = 'pause'  | '2captcha' | 'rotate_proxy'

export interface CaptchaConfig {
  strategy:        CaptchaStrategy
  twoCaptchaKey?:  string
  pauseTimeoutMs?: number   // how long to wait before giving up
}

const CAPTCHA_SIGNALS = [
  'captcha',
  'recaptcha',
  'unusual traffic',
  'automated queries',
  'detected unusual',
  'please verify',
  'not a robot',
  'are you a robot',
  '/sorry/index',
  'g-recaptcha',
]

export async function detectCaptcha(page: Page): Promise<boolean> {
  try {
    const url     = page.url()
    const content = await page.content()
    const lower   = content.toLowerCase()

    // URL-based detection
    if (url.includes('/sorry/') || url.includes('captcha')) return true

    // Content-based detection
    return CAPTCHA_SIGNALS.some((signal) => lower.includes(signal))
  } catch {
    return false
  }
}

export async function handleCaptcha(
  page: Page,
  config: CaptchaConfig,
  onPause?: (message: string) => void
): Promise<'solved' | 'failed' | 'rotated'> {
  console.warn('[CaptchaHandler] CAPTCHA detected on:', page.url())

  switch (config.strategy) {
    case 'pause': {
      // Notify the user via the progress callback and wait
      const message = 'CAPTCHA detected — waiting for manual solve or timeout...'
      console.warn(`[CaptchaHandler] ${message}`)
      onPause?.(message)

      const timeout  = config.pauseTimeoutMs ?? 120_000  // 2 minutes default
      const interval = 3000
      let   waited   = 0

      while (waited < timeout) {
        await humanDelay(interval, interval)
        waited += interval
        const stillBlocked = await detectCaptcha(page)
        if (!stillBlocked) {
          console.log('[CaptchaHandler] CAPTCHA resolved, continuing...')
          return 'solved'
        }
      }

      console.warn('[CaptchaHandler] CAPTCHA timeout — marking as failed')
      return 'failed'
    }

    case '2captcha': {
      if (!config.twoCaptchaKey) return 'failed'
      try {
        // Get sitekey from the page
        const siteKey = await page.$eval(
          '.g-recaptcha, [data-sitekey]',
          (el) => el.getAttribute('data-sitekey')
        ).catch(() => null)

        if (!siteKey) return 'failed'

        // Submit to 2captcha
        const submitRes = await fetch(
          `https://2captcha.com/in.php?key=${config.twoCaptchaKey}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${encodeURIComponent(page.url())}`
        )
        const submitText = await submitRes.text()
        if (!submitText.startsWith('OK|')) return 'failed'

        const captchaId = submitText.split('|')[1]

        // Poll for result (up to 2 minutes)
        for (let i = 0; i < 24; i++) {
          await humanDelay(5000, 5000)
          const resultRes = await fetch(
            `https://2captcha.com/res.php?key=${config.twoCaptchaKey}&action=get&id=${captchaId}`
          )
          const resultText = await resultRes.text()
          if (resultText === 'CAPCHA_NOT_READY') continue
          if (!resultText.startsWith('OK|')) return 'failed'

          const token = resultText.split('|')[1]

          // Inject the token into the page
          await page.evaluate((t: string) => {
            const el = document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement | null
            if (el) {
              el.innerHTML = t
              el.style.display = 'block'
            }
            // Trigger any callback
            const callback = (window as any).grecaptcha?.getResponse
            if (callback) callback()
          }, token)

          await humanDelay(1000, 2000)
          return 'solved'
        }

        return 'failed'
      } catch (err) {
        console.error('[CaptchaHandler] 2captcha error:', err)
        return 'failed'
      }
    }

    case 'rotate_proxy': {
      // Signal the orchestrator to switch proxy and retry
      return 'rotated'
    }

    default:
      return 'failed'
  }
}
