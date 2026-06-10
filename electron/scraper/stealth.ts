// electron/scraper/stealth.ts
import { chromium } from 'playwright-extra'
import StealthPlugin from 'playwright-extra-plugin-stealth'
import type { Browser, BrowserContext } from 'playwright'
import type { ProxyConfig } from '../../src/types/scraper.types'

chromium.use(StealthPlugin())

let _browser: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser
  _browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  })
  return _browser
}

export async function createContext(proxy?: ProxyConfig | null): Promise<BrowserContext> {
  const browser = await getBrowser()
  return browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    proxy: proxy
      ? {
          server: proxy.url,
          username: proxy.username || undefined,
          password: proxy.password || undefined,
        }
      : undefined,
  })
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close()
    _browser = null
  }
}
