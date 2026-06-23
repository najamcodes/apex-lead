// electron/scraper/engine/adaptive-throttler.ts
// Dynamically adjusts delays based on response times and error rates.
// Fast when healthy, slow when blocked.

export class AdaptiveThrottler {
  private requestTimes:    number[] = []    // last N response times (ms)
  private errorCount:      number   = 0
  private successCount:    number   = 0
  private currentMultiplier: number = 1.0  // 1.0 = normal, 2.0 = slow, 0.5 = fast

  private readonly BASE_DELAY_MS   = 1500
  private readonly MAX_DELAY_MS    = 8000
  private readonly MIN_DELAY_MS    = 500
  private readonly WINDOW_SIZE     = 10    // measure last 10 requests

  recordSuccess(responseTimeMs: number): void {
    this.successCount++
    this.errorCount = Math.max(0, this.errorCount - 1)  // decay errors on success
    this.requestTimes.push(responseTimeMs)
    if (this.requestTimes.length > this.WINDOW_SIZE) {
      this.requestTimes.shift()
    }
    this.recalculate()
  }

  recordError(): void {
    this.errorCount++
    this.recalculate()
  }

  recordBlock(): void {
    // Detected throttling or soft block — back off hard
    this.errorCount += 5
    this.currentMultiplier = Math.min(this.currentMultiplier * 2, 4.0)
  }

  private recalculate(): void {
    const errorRate = this.errorCount / Math.max(this.successCount + this.errorCount, 1)
    const avgResponseTime = this.requestTimes.length > 0
      ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length
      : 1000

    // Slow response times = server is under load = back off
    if (avgResponseTime > 5000) {
      this.currentMultiplier = Math.min(this.currentMultiplier * 1.3, 3.0)
    } else if (avgResponseTime < 1000 && errorRate < 0.05) {
      // Fast + low error = we can speed up
      this.currentMultiplier = Math.max(this.currentMultiplier * 0.9, 0.5)
    }

    // High error rate = slow down significantly
    if (errorRate > 0.3) {
      this.currentMultiplier = Math.min(this.currentMultiplier * 1.5, 4.0)
    }
  }

  async wait(): Promise<void> {
    const base   = this.BASE_DELAY_MS * this.currentMultiplier
    const jitter = (Math.random() - 0.5) * base * 0.3  // ±15% jitter
    const delay  = Math.max(this.MIN_DELAY_MS, Math.min(this.MAX_DELAY_MS, base + jitter))
    await new Promise((r) => setTimeout(r, delay))
  }

  async waitBetweenBatches(): Promise<void> {
    // Longer pause between batches of results
    const delay = (5000 + Math.random() * 5000) * this.currentMultiplier
    await new Promise((r) => setTimeout(r, Math.min(delay, 30000)))
  }

  getStatus(): { multiplier: number; avgResponseMs: number; errorRate: number } {
    const errorRate = this.errorCount / Math.max(this.successCount + this.errorCount, 1)
    const avgResponseMs = this.requestTimes.length > 0
      ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length
      : 0
    return { multiplier: this.currentMultiplier, avgResponseMs, errorRate }
  }
}
