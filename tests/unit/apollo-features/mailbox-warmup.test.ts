import '../../../server/polyfill'
import { describe, it, expect, beforeAll } from 'bun:test'
import { initDb } from '@sdk/core/db'
import { MailboxRotatorService } from '../../../server/src/services/mail/MailboxRotatorService'
import { WarmupEngineService } from '../../../server/src/services/mail/WarmupEngineService'
import { DnsDeliverabilityAuditor } from '../../../server/src/services/mail/DnsDeliverabilityAuditor'

describe('MailboxRotatorService & WarmupEngineService (Phase 5)', () => {
  let rotator: MailboxRotatorService
  let warmup: WarmupEngineService
  let orgId: number

  beforeAll(async () => {
    orgId = Math.floor(Math.random() * 900000) + 100000
    const ds = await initDb()
    rotator = new MailboxRotatorService(ds)
    warmup = new WarmupEngineService(ds)
  })

  it('should calculate proper daily warmup ramps across 21 days', () => {
    expect(warmup.getRampQuotaForDay(1)).toBe(5)
    expect(warmup.getRampQuotaForDay(3)).toBe(5)
    expect(warmup.getRampQuotaForDay(5)).toBe(15)
    expect(warmup.getRampQuotaForDay(10)).toBe(25)
    expect(warmup.getRampQuotaForDay(18)).toBe(40)
    expect(warmup.getRampQuotaForDay(25)).toBe(50)
  })

  it('should round-robin least-loaded active mailbox and respect daily quotas', async () => {
    const emailA = `outreach-a-${Date.now()}@domain.com`
    const emailB = `outreach-b-${Date.now()}@domain.com`

    const boxA = await rotator.addMailbox(orgId, {
      email: emailA,
      fromName: 'Outreach A',
      smtpHost: 'smtp.domain.com',
      smtpUsername: emailA,
      smtpPasswordEncrypted: 'pass123',
      dailyQuota: 2,
    })

    const boxB = await rotator.addMailbox(orgId, {
      email: emailB,
      fromName: 'Outreach B',
      smtpHost: 'smtp.domain.com',
      smtpUsername: emailB,
      smtpPasswordEncrypted: 'pass123',
      dailyQuota: 5,
    })

    // Both currently have 0 sends. First available returned
    let selected = await rotator.getNextAvailableMailbox(orgId)
    expect(selected).not.toBeNull()

    // Record 2 sends for Box A (exhausting its daily quota of 2)
    await rotator.recordSend(boxA.id)
    await rotator.recordSend(boxA.id)

    // Next selected MUST be Box B (Box A is exhausted)
    selected = await rotator.getNextAvailableMailbox(orgId)
    expect(selected?.id).toBe(boxB.id)

    // Reset daily quotas
    await rotator.resetDailyQuotas()
    const refreshed = await rotator.getNextAvailableMailbox(orgId)
    expect(refreshed?.current_day_sends).toBe(0)
  })

  it('should perform DNS deliverability audit structure check', async () => {
    const audit = await DnsDeliverabilityAuditor.auditDomain('apexlead.internal')
    expect(audit).toBeDefined()
    expect(audit.score).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(audit.recommendations)).toBe(true)
  })
})
