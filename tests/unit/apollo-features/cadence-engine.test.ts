import '../../../server/polyfill'
import { describe, it, expect, beforeAll } from 'bun:test'
import { initDb } from '@sdk/core/db'
import { CadenceEngineService } from '../../../server/src/services/cadences/CadenceEngineService'
import { ReplyDetectorService } from '../../../server/src/services/cadences/ReplyDetectorService'
import { CadenceEnrollmentEntity } from '@sdk/core/db/entities/CadenceEnrollmentEntity'

describe('CadenceEngineService & ReplyDetectorService (Phase 5)', () => {
  let engine: CadenceEngineService
  let replyDetector: ReplyDetectorService
  const orgId = 1001

  beforeAll(async () => {
    const ds = await initDb()
    engine = new CadenceEngineService(ds)
    replyDetector = new ReplyDetectorService(ds)
  })

  it('should create cadence, add steps, and enroll records', async () => {
    const cadence = await engine.createCadence(orgId, 'Contractor Outbound Sequence', 100)
    expect(cadence.id).toBeDefined()
    expect(cadence.name).toBe('Contractor Outbound Sequence')

    const step1 = await engine.addStep(
      cadence.id,
      1,
      1,
      '{Quick question|Quick inquiry} for {first_name}',
      'Hi {first_name}, {noticed your work|saw your recent projects} in {city}.'
    )
    expect(step1.id).toBeDefined()
    expect(step1.step_number).toBe(1)

    const step2 = await engine.addStep(
      cadence.id,
      2,
      3,
      'Re: {Quick question|Quick inquiry}',
      'Following up on my note below, {first_name}.'
    )
    expect(step2.id).toBeDefined()
    expect(step2.step_number).toBe(2)

    const enrollment = await engine.enrollRecord(
      orgId,
      cadence.id,
      `rec-${Date.now()}`,
      `marcus-${Date.now()}@apexroofingtx.com`
    )
    expect(enrollment.id).toBeDefined()
    expect(enrollment.status).toBe('queued')
    expect(enrollment.current_step).toBe(1)

    // Process Step 1
    const step1Result = await engine.processStepForEnrollment(enrollment.id, {
      first_name: 'Marcus',
      city: 'Dallas',
    })
    expect(step1Result.completed).toBe(false)
    expect(step1Result.nextStepNumber).toBe(2)
    expect(step1Result.body).toContain('Marcus')

    // Process Step 2
    const step2Result = await engine.processStepForEnrollment(enrollment.id, {
      first_name: 'Marcus',
    })
    expect(step2Result.completed).toBe(true)
    expect(step2Result.body).toContain('Marcus')
  })

  it('should auto-pause cadence enrollments upon incoming reply detection', async () => {
    const cadence = await engine.createCadence(orgId, 'Roofing SDR Cadence', 50)
    const testEmail = `prospect-reply-${Date.now()}@domain.com`

    const enrollment = await engine.enrollRecord(
      orgId,
      cadence.id,
      `rec-reply-${Date.now()}`,
      testEmail
    )
    expect(enrollment.status).toBe('queued')

    // Ingest reply
    const replyResult = await replyDetector.handleIncomingReply({
      fromEmail: testEmail,
      subject: 'Re: Quick inquiry - Interested!',
      bodySnippet: 'Thanks for reaching out, lets talk tomorrow.',
    })

    expect(replyResult.haltedCount).toBe(1)

    const ds = await initDb()
    const updated = await ds.getRepository(CadenceEnrollmentEntity).findOneBy({ id: enrollment.id })
    expect(updated?.status).toBe('replied')
  })
})
