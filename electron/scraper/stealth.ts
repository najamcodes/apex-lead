// electron/scraper/stealth.ts
// Robust browser factory with stealth settings tuned for Google Maps.

import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'

let _browser: Browser | null = null

// Human-like viewport sizes — avoids headless detection
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser

  _browser = await chromium.launch({
    headless: false, // For debugging (headless: true normally)
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-notifications',
      '--disable-popup-blocking',
      '--disable-translate',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  })

  return _browser
}

export async function createStealthContext(proxyConfig?: {
  server: string
  username?: string
  password?: string
} | null): Promise<BrowserContext> {
  const browser = await getBrowser()
  const viewport = randomItem(VIEWPORTS)
  const userAgent = randomItem(USER_AGENTS)

  const context = await browser.newContext({
    viewport,
    userAgent,
    locale: 'en-US',
    timezoneId: 'Asia/Karachi',
    geolocation: undefined,
    permissions: [],
    proxy: proxyConfig ?? undefined,
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  })

  // Patch navigator properties to hide automation
  await context.addInitScript(() => {
    // Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    })

    // Mock plugins array (headless Chrome has none)
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    })

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    })

    // Mock chrome runtime
    ;(window as any).chrome = {
      runtime: {},
      loadTimes: () => {},
      csi: () => {},
      app: {},
    }

    // Override permissions query
    const originalQuery = window.navigator.permissions.query
    ;(window.navigator.permissions as any).query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters)
  })

  return context
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close().catch(() => {})
    _browser = null
  }
}

// Human-like delay — random range
export async function humanDelay(minMs = 800, maxMs = 2000): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs)
  await new Promise((r) => setTimeout(r, ms))
}

// Human-like scroll — smooth, incremental
export async function smoothScroll(
  page: Page,
  selector: string,
  amount: number
): Promise<void> {
  await page.evaluate(
    ({ sel, amt }: { sel: string; amt: number }) => {
      const el = document.querySelector(sel)
      if (!el) return
      const steps = 8
      const stepSize = amt / steps
      let i = 0
      const interval = setInterval(() => {
        el.scrollTop += stepSize
        i++
        if (i >= steps) clearInterval(interval)
      }, 50)
    },
    { sel: selector, amt: amount }
  )
  await new Promise((r) => setTimeout(r, 500))
}
