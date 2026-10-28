import '../../../server/polyfill'
import { describe, it, expect, beforeAll } from 'bun:test'
import { initDb, getDataSource } from '@sdk/core/db'
import { VoiceAiService } from '../../../server/src/services/voice/VoiceAiService'
import { QuotaService } from '../../../server/src/services/QuotaService'
import { OrganizationEntity } from '@sdk/core/db/entities/OrganizationEntity'
import { VoiceCampaignEntity } from '@sdk/core/db/entities/VoiceCampaignEntity'
import { VoiceCallEntity } from '@sdk/core/db/entities/VoiceCallEntity'

describe('Autonomous Voice AI SDR Caller (Phase 6)', () => {
  let voiceAiService: VoiceAiService
  let quotaService: QuotaService
  let org: OrganizationEntity
  let campaign: VoiceCampaignEntity

  beforeAll(async () => {
    process.env.DATABASE_URL = ''
    const ds = await initDb()
    quotaService = new QuotaService()
    voiceAiService = new VoiceAiService(ds, quotaService)

    const orgRepo = ds.getRepository(OrganizationEntity)
    const campaignRepo = ds.getRepository(VoiceCampaignEntity)

    org = await orgRepo.save(
      orgRepo.create({
        name: `Voice AI Test Org ${Date.now()}`,
        tier: 'pro',
      })
    )

    campaign = await campaignRepo.save(
      campaignRepo.create({
        org_id: org.id,
        name: 'Inbound Qualifier Campaign',
        first_sentence_template: 'Hi {first_name}, {this is|calling from} Apex Lead Desk regarding {company}.',
        system_prompt_template: 'You are an AI SDR for {company}. Qualify lead in {city} for commercial HVAC.',
        voice_id: 'elevenlabs_rachel_multilingual',
        max_duration_seconds: 180,
      })
    )
  })

  it('should initiate voice call with spintax personalized prompt and assert quota', async () => {
    const call = await voiceAiService.initiateCall({
      orgId: org.id,
      campaignId: campaign.id,
      recordId: 'rec-test-lead-100',
      recipientPhone: '+15125550199',
      recordData: {
        first_name: 'David',
        company: 'Austin Thermal Works',
        city: 'Austin',
      },
    })

    expect(call).toBeDefined()
    expect(call.id).toBeDefined()
    expect(call.org_id).toBe(org.id)
    expect(call.recipient_phone).toBe('+15125550199')
    expect(call.status).toBe('initiated')
    expect(call.call_sid).toMatch(/^call_\d+_[a-z0-9]+$/)

    const answers = JSON.parse(call.qualification_answers || '{}')
    expect(answers.firstSentenceRendered).toContain('David')
    expect(answers.firstSentenceRendered).toContain('Austin Thermal Works')
    expect(answers.systemPromptRendered).toContain('Austin Thermal Works')
    expect(answers.systemPromptRendered).toContain('Austin')
  })

  it('should reject call initiation if campaign does not belong to organization', async () => {
    await expect(
      voiceAiService.initiateCall({
        orgId: 999999, // Unmatched organization ID
        campaignId: campaign.id,
        recordId: 'rec-test-lead-101',
        recipientPhone: '+15125550199',
        recordData: {},
      })
    ).rejects.toThrow(/Voice campaign not found/)
  })

  it('should handle call completion webhook, store transcript, and deduct usage tokens', async () => {
    const call = await voiceAiService.initiateCall({
      orgId: org.id,
      campaignId: campaign.id,
      recordId: 'rec-test-lead-102',
      recipientPhone: '+15125550200',
      recordData: { first_name: 'Sarah', company: 'Summit Energy' },
    })

    const apptDate = new Date(Date.now() + 86400000 * 2)
    const completedCall = await voiceAiService.handleCallCompletion(call.call_sid, {
      durationSeconds: 125, // 2m 5s => ceil(125/60) = 3 quota units
      transcript: 'Agent: Hi Sarah. Prospect: Yes, we need commercial HVAC maintenance next week.',
      summary: 'Prospect interested in quarterly maintenance. Scheduled demo.',
      sentimentScore: 0.94,
      appointmentBooked: true,
      appointmentTime: apptDate,
      answers: { budget: '$15k-$20k', timing: 'Within 30 days' },
    })

    expect(completedCall).not.toBeNull()
    expect(completedCall?.status).toBe('completed')
    expect(completedCall?.duration_seconds).toBe(125)
    expect(completedCall?.sentiment_score).toBe(0.94)
    expect(completedCall?.appointment_booked).toBe(true)
    expect(completedCall?.transcript).toContain('commercial HVAC maintenance')

    const storedAnswers = JSON.parse(completedCall?.qualification_answers || '{}')
    expect(storedAnswers.budget).toBe('$15k-$20k')

    // Verify usage tracking incremented
    const usageCheck = await quotaService.checkQuota(org.id, 'aiCalls', 1)
    // Pro tier has 2500 aiCalls, 3 were consumed: 2500 - 3 = 2497 remaining
    expect(usageCheck.remaining).toBe(2497)
  })
})
