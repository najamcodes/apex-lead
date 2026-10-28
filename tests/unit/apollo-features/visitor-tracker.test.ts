import '../../../server/polyfill'
import { describe, it, expect, beforeAll } from 'bun:test'
import { initDb } from '@sdk/core/db'
import { VisitorSessionService } from '../../../server/src/services/visitors/VisitorSessionService'
import { SlackAlertNotifier } from '../../../server/src/services/visitors/SlackAlertNotifier'
import { ReverseIpResolver } from '../../../server/src/services/visitors/ReverseIpResolver'
import { VisitorSiteEntity } from '@sdk/core/db/entities/VisitorSiteEntity'

describe('VisitorSessionService & ReverseIpResolver (Phase 5)', () => {
  let sessionService: VisitorSessionService
  let siteKey: string
  const orgId = 1003

  beforeAll(async () => {
    const ds = await initDb()
    const notifier = new SlackAlertNotifier()
    sessionService = new VisitorSessionService(ds, notifier)

    const siteRepo = ds.getRepository(VisitorSiteEntity)
    siteKey = `test_site_${Date.now()}`
    const site = siteRepo.create({
      org_id: orgId,
      domain: 'mycontractingfirm.com',
      api_key: siteKey,
    })
    await siteRepo.save(site)
  })

  it('should identify local/internal IP addresses as commercial test orgs', async () => {
    const local = await ReverseIpResolver.resolveIp('127.0.0.1')
    expect(local.isCommercial).toBe(true)
    expect(local.companyName).toBe('Local Development Corp')
  })

  it('should record pageviews and increase intent score on /pricing visits', async () => {
    const sessionId = `sid_${Date.now()}`

    // Event 1: Normal homepage visit
    const res1 = await sessionService.trackEvent({
      siteKey,
      sessionId,
      ip: '127.0.0.1',
      path: '/',
      durationSeconds: 15,
    })
    expect(res1.session).not.toBeNull()
    expect(res1.session?.pageview_count).toBe(1)
    expect(res1.session?.visited_pricing).toBe(false)
    expect(res1.session?.intent_score).toBe(10)

    // Event 2: High-intent pricing page visit
    const res2 = await sessionService.trackEvent({
      siteKey,
      sessionId,
      ip: '127.0.0.1',
      path: '/pricing',
      durationSeconds: 75,
    })
    expect(res2.session).not.toBeNull()
    expect(res2.session?.pageview_count).toBe(2)
    expect(res2.session?.visited_pricing).toBe(true)
    // 10 + 5 (pageview) + 25 (pricing) + 10 (duration > 60) = 50
    expect(res2.session?.intent_score).toBe(50)
  })

  it('should reject invalid site keys cleanly', async () => {
    const res = await sessionService.trackEvent({
      siteKey: 'invalid_key',
      sessionId: 'any',
      ip: '127.0.0.1',
      path: '/',
    })
    expect(res.session).toBeNull()
  })
})
