// electron/scraper/stealth.ts

import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'
import crypto from 'crypto'

// ─── Fingerprint profiles — each simulates a different real user ──────────────

interface FingerprintProfile {
  userAgent: string
  viewport:  { width: number; height: number }
  locale:    string
  timezone:  string
  platform:  string
  colorDepth: number
  deviceMemory: number
  hardwareConcurrency: number
  webGLVendor: string
  webGLRenderer: string
}

const FINGERPRINT_PROFILES: FingerprintProfile[] = [
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US', timezone: 'America/New_York',
    platform: 'Win32', colorDepth: 24, deviceMemory: 8,
    hardwareConcurrency: 8,
    webGLVendor: 'Google Inc. (NVIDIA)',
    webGLRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US', timezone: 'America/Los_Angeles',
    platform: 'MacIntel', colorDepth: 30, deviceMemory: 16,
    hardwareConcurrency: 10,
    webGLVendor: 'Apple Inc.',
    webGLRenderer: 'Apple M1 Pro',
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-GB', timezone: 'Europe/London',
    platform: 'Win32', colorDepth: 24, deviceMemory: 4,
    hardwareConcurrency: 4,
    webGLVendor: 'Google Inc. (Intel)',
    webGLRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US', timezone: 'America/Chicago',
    platform: 'Win32', colorDepth: 24, deviceMemory: 8,
    hardwareConcurrency: 6,
    webGLVendor: 'Google Inc. (AMD)',
    webGLRenderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  },
]

// ─── Browser pool ─────────────────────────────────────────────────────────────

interface BrowserSlot {
  browser:     Browser
  profile:     FingerprintProfile
  createdAt:   number
  requestCount: number
  headless:    boolean
}

const BROWSER_MAX_REQUESTS = 150   // recycle browser after N requests
const BROWSER_MAX_AGE_MS   = 30 * 60 * 1000  // recycle after 30 minutes

class BrowserPool {
  private slots: Map<string, BrowserSlot> = new Map()

  async acquire(proxyConfig?: ProxyConfig | null, headless: boolean = true): Promise<{ browser: Browser; profile: FingerprintProfile; id: string }> {
    // Find an existing healthy slot
    for (const [id, slot] of this.slots) {
      const age = Date.now() - slot.createdAt
      if (
        slot.browser.isConnected() &&
        slot.requestCount < BROWSER_MAX_REQUESTS &&
        age < BROWSER_MAX_AGE_MS &&
        slot.headless === headless
      ) {
        slot.requestCount++
        return { browser: slot.browser, profile: slot.profile, id }
      } else {
        // Stale — clean up
        await slot.browser.close().catch(() => {})
        this.slots.delete(id)
      }
    }

    // Create new browser
    return this.createNew(proxyConfig, headless)
  }

  private async createNew(proxyConfig?: ProxyConfig | null, headless: boolean = true): Promise<{ browser: Browser; profile: FingerprintProfile; id: string }> {
    const profile = FINGERPRINT_PROFILES[Math.floor(Math.random() * FINGERPRINT_PROFILES.length)]
    const id = crypto.randomUUID()

    const browser = await chromium.launch({
      headless: headless,
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
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        `--window-size=${profile.viewport.width},${profile.viewport.height}`,
        ...(proxyConfig ? [`--proxy-server=${proxyConfig.server}`] : []),
      ],
    })

    this.slots.set(id, {
      browser,
      profile,
      createdAt: Date.now(),
      requestCount: 1,
      headless,
    })

    return { browser, profile, id }
  }

  async closeAll(): Promise<void> {
    for (const [id, slot] of this.slots) {
      await slot.browser.close().catch(() => {})
      this.slots.delete(id)
    }
  }
}

export const browserPool = new BrowserPool()

// ─── Context factory ──────────────────────────────────────────────────────────

export interface ProxyConfig {
  server:    string
  username?: string
  password?: string
}

export async function createStealthContext(
  proxyConfig?: ProxyConfig | null,
  headless: boolean = true
): Promise<{ context: BrowserContext; profile: FingerprintProfile }> {
  const { browser, profile } = await browserPool.acquire(proxyConfig, headless)

  const context = await browser.newContext({
    viewport:   profile.viewport,
    userAgent:  profile.userAgent,
    locale:     profile.locale,
    timezoneId: profile.timezone,
    colorScheme: 'light',
    permissions: ['geolocation'],
    proxy: proxyConfig ? {
      server:   proxyConfig.server,
      username: proxyConfig.username,
      password: proxyConfig.password,
    } : undefined,
    extraHTTPHeaders: {
      'Accept-Language':  `${profile.locale},en;q=0.9`,
      'Accept-Encoding':  'gzip, deflate, br',
      'sec-ch-ua':        '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': `"${profile.platform === 'MacIntel' ? 'macOS' : 'Windows'}"`,
    },
  })

  // ── Deep stealth patches ────────────────────────────────────────────────────
  await context.addInitScript((fp: FingerprintProfile) => {
    // Remove automation flags
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })

    // Platform
    Object.defineProperty(navigator, 'platform', { get: () => fp.platform })

    // Memory + concurrency
    Object.defineProperty(navigator, 'deviceMemory', { get: () => fp.deviceMemory })
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.hardwareConcurrency })

    // Languages
    Object.defineProperty(navigator, 'languages', { get: () => [fp.locale, 'en'] })

    // Plugins — fake a populated list
    const fakePlugins = [
      { name: 'Chrome PDF Plugin',    filename: 'internal-pdf-viewer',    description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer',    filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client',        filename: 'internal-nacl-plugin',   description: '' },
    ]
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const arr = fakePlugins as any
        arr.item  = (i: number) => fakePlugins[i]
        arr.namedItem = (name: string) => fakePlugins.find((p) => p.name === name) ?? null
        arr.refresh = () => {}
        return arr
      },
    })

    // MimeTypes
    Object.defineProperty(navigator, 'mimeTypes', {
      get: () => ({ length: 2, item: () => null, namedItem: () => null }),
    })

    // Screen
    Object.defineProperty(screen, 'colorDepth', { get: () => fp.colorDepth })
    Object.defineProperty(screen, 'pixelDepth',  { get: () => fp.colorDepth })

    // Chrome runtime object
    ;(window as any).chrome = {
      runtime:    { onMessage: { addListener: () => {}, removeListener: () => {} } },
      loadTimes:  () => ({ requestTime: performance.now() / 1000 }),
      csi:        () => ({ startE: Date.now(), onloadT: Date.now() + 300, pageT: 300, tran: 15 }),
      app:        { isInstalled: false, InstallState: {}, RunningState: {} },
    }

    // WebGL fingerprint
    const getParam = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = function(param: number) {
      if (param === 37445) return fp.webGLVendor    // UNMASKED_VENDOR_WEBGL
      if (param === 37446) return fp.webGLRenderer  // UNMASKED_RENDERER_WEBGL
      return getParam.call(this, param)
    }

    // Permissions API
    const origQuery = navigator.permissions.query.bind(navigator.permissions)
    navigator.permissions.query = (desc: any) => {
      if (desc.name === 'notifications') {
        return Promise.resolve({ state: 'prompt', onchange: null } as any)
      }
      return origQuery(desc)
    }

    // Battery API — return fake data
    ;(navigator as any).getBattery = () =>
      Promise.resolve({ charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1 })

    // Connection API
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g', rtt: 50, downlink: 10, saveData: false,
      }),
    })
  }, profile)

  return { context, profile }
}

// ─── Human behavior simulation ────────────────────────────────────────────────

export function humanDelay(minMs = 500, maxMs = 1500): Promise<void> {
  // Gaussian-ish distribution — more realistic than uniform random
  const u1 = Math.random()
  const u2 = Math.random()
  const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  const mid = (minMs + maxMs) / 2
  const std = (maxMs - minMs) / 4
  const ms  = Math.max(minMs, Math.min(maxMs, mid + gaussian * std))
  return new Promise((r) => setTimeout(r, ms))
}

export async function humanScroll(page: Page, selector: string, targetScrollTop: number): Promise<void> {
  await page.evaluate(
    async ({ sel, target }: { sel: string; target: number }) => {
      const el = document.querySelector(sel) as HTMLElement | null
      if (!el) return

      const start    = el.scrollTop
      const distance = target - start
      const duration = 600 + Math.random() * 400  // 600–1000ms
      const startTime = performance.now()

      return new Promise<void>((resolve) => {
        function step(now: number) {
          const elapsed  = now - startTime
          const progress = Math.min(elapsed / duration, 1)
          // Ease-in-out cubic
          const ease = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2
          el!.scrollTop = start + distance * ease
          if (progress < 1) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      })
    },
    { sel: selector, target: targetScrollTop }
  )
}

export async function humanMouseMove(page: Page): Promise<void> {
  // Move mouse to a random position — signals human presence to bot detectors
  const x = 100 + Math.random() * 800
  const y = 100 + Math.random() * 400
  await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 10) })
}
