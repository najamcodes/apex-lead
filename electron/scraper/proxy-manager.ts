// electron/scraper/proxy-manager.ts
import type { ProxyConfig } from '../../src/types/scraper.types'

export class ProxyManager {
  private proxies: ProxyConfig[] = []
  private currentIndex = 0

  load(proxies: ProxyConfig[]): void {
    this.proxies = proxies.filter((p) => p.url.trim() !== '')
    this.currentIndex = 0
  }

  hasProxies(): boolean {
    return this.proxies.length > 0
  }

  next(): ProxyConfig | null {
    if (!this.hasProxies()) return null
    const proxy = this.proxies[this.currentIndex]
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length
    return proxy
  }

  // Validate a proxy by making a test request
  async validate(proxy: ProxyConfig): Promise<boolean> {
    try {
      const url = new URL(proxy.url)
      // Basic TCP check — Phase 3 can do a real HTTP test
      return url.hostname.length > 0
    } catch {
      return false
    }
  }
}

export const proxyManager = new ProxyManager()
