// electron/scraper/engine/proxy-rotator.ts
// Manages a pool of proxies with health tracking and automatic rotation.

import type { ProxyConfig } from '../stealth'

export interface ProxyEntry extends ProxyConfig {
  id:            string
  failCount:     number
  successCount:  number
  lastUsed:      number
  bannedUntil:   number | null   // timestamp — proxy banned until then
  avgLatencyMs:  number
}

export class ProxyRotator {
  private proxies: ProxyEntry[] = []

  load(rawProxies: ProxyConfig[]): void {
    this.proxies = rawProxies
      .filter((p) => p.server.trim() !== '')
      .map((p, i) => ({
        ...p,
        id:           `proxy-${i}`,
        failCount:    0,
        successCount: 0,
        lastUsed:     0,
        bannedUntil:  null,
        avgLatencyMs: 0,
      }))
    console.log(`[ProxyRotator] Loaded ${this.proxies.length} proxies`)
  }

  next(): ProxyEntry | null {
    if (this.proxies.length === 0) return null

    const now = Date.now()
    const available = this.proxies.filter(
      (p) => p.bannedUntil === null || p.bannedUntil < now
    )

    if (available.length === 0) {
      console.warn('[ProxyRotator] All proxies banned — waiting for cooldown')
      // Reset the one that has been banned longest
      const oldest = this.proxies.sort((a, b) => (a.bannedUntil ?? 0) - (b.bannedUntil ?? 0))[0]
      oldest.bannedUntil = null
      oldest.failCount = 0
      return oldest
    }

    // Pick least recently used healthy proxy
    const sorted = available.sort((a, b) => {
      // Prefer low fail count + low latency + not recently used
      const scoreA = a.failCount * 100 + a.avgLatencyMs / 10 + (now - a.lastUsed) / -1000
      const scoreB = b.failCount * 100 + b.avgLatencyMs / 10 + (now - b.lastUsed) / -1000
      return scoreA - scoreB
    })

    const proxy = sorted[0]
    proxy.lastUsed = now
    return proxy
  }

  recordSuccess(proxyId: string, latencyMs: number): void {
    const proxy = this.proxies.find((p) => p.id === proxyId)
    if (!proxy) return
    proxy.successCount++
    proxy.failCount = Math.max(0, proxy.failCount - 1)
    // Rolling average latency
    proxy.avgLatencyMs = proxy.avgLatencyMs === 0
      ? latencyMs
      : proxy.avgLatencyMs * 0.7 + latencyMs * 0.3
  }

  recordFailure(proxyId: string): void {
    const proxy = this.proxies.find((p) => p.id === proxyId)
    if (!proxy) return
    proxy.failCount++
    if (proxy.failCount >= 3) {
      // Ban for 10 minutes
      proxy.bannedUntil = Date.now() + 10 * 60 * 1000
      console.warn(`[ProxyRotator] Proxy ${proxyId} banned for 10 minutes`)
    }
  }

  recordBan(proxyId: string): void {
    const proxy = this.proxies.find((p) => p.id === proxyId)
    if (!proxy) return
    // Longer ban for detected blocks
    proxy.bannedUntil = Date.now() + 60 * 60 * 1000  // 1 hour
    console.warn(`[ProxyRotator] Proxy ${proxyId} hard-banned for 1 hour`)
  }

  getHealthReport(): string {
    const total   = this.proxies.length
    const banned  = this.proxies.filter((p) => p.bannedUntil && p.bannedUntil > Date.now()).length
    const healthy = total - banned
    return `Proxies: ${healthy}/${total} healthy, ${banned} banned`
  }

  hasProxies(): boolean {
    return this.proxies.length > 0
  }
}

export const proxyRotator = new ProxyRotator()
