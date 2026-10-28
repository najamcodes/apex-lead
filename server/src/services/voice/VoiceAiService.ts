import { DataSource } from 'typeorm'
import { VoiceCampaignEntity } from '../../db/entities/VoiceCampaignEntity'
import { VoiceCallEntity } from '../../db/entities/VoiceCallEntity'
import { SpintaxParser } from '../cadences/SpintaxParser'
import { QuotaService } from '../QuotaService'

export interface InitiateCallParams {
  orgId: number
  campaignId: string
  recordId: string
  recipientPhone: string
  recordData: Record<string, unknown>
}

export class VoiceAiService {
  constructor(
    private dataSource: DataSource,
    private quotaService: QuotaService
  ) {}

  public async initiateCall(params: InitiateCallParams): Promise<VoiceCallEntity> {
    const { orgId, campaignId, recordId, recipientPhone, recordData } = params

    // 1. Quota check
    await this.quotaService.assertQuotaAvailable(orgId, 'aiCalls', 1)

    // 2. Fetch Campaign
    const campaignRepo = this.dataSource.getRepository(VoiceCampaignEntity)
    const callRepo = this.dataSource.getRepository(VoiceCallEntity)

    const campaign = await campaignRepo.findOne({
      where: { id: campaignId, org_id: orgId },
    })

    if (!campaign) {
      throw new Error(`Voice campaign not found: ${campaignId}`)
    }

    // 3. Render Personalized First Sentence & Context Prompt
    const firstSentence = SpintaxParser.parse(campaign.first_sentence_template, recordData)
    const systemPrompt = SpintaxParser.parse(campaign.system_prompt_template, recordData)

    // 4. Create Simulated / Vapi Call Session
    const callSid = `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const call = callRepo.create({
      org_id: orgId,
      campaign_id: campaignId,
      record_id: recordId,
      call_sid: callSid,
      recipient_phone: recipientPhone,
      status: 'initiated',
      duration_seconds: 0,
      qualification_answers: JSON.stringify({
        firstSentenceRendered: firstSentence,
        systemPromptRendered: systemPrompt,
      }),
    })

    return callRepo.save(call)
  }

  public async handleCallCompletion(
    callSid: string,
    data: {
      durationSeconds: number
      transcript: string
      summary?: string
      sentimentScore?: number
      appointmentBooked?: boolean
      appointmentTime?: Date
      answers?: Record<string, unknown>
    }
  ): Promise<VoiceCallEntity | null> {
    const callRepo = this.dataSource.getRepository(VoiceCallEntity)
    const call = await callRepo.findOne({ where: { call_sid: callSid } })
    if (!call) return null

    call.status = 'completed'
    call.duration_seconds = data.durationSeconds
    call.transcript = data.transcript
    call.summary = data.summary
    call.sentiment_score = data.sentimentScore ?? 0.8
    call.appointment_booked = Boolean(data.appointmentBooked)
    call.appointment_time = data.appointmentTime
    call.finished_at = new Date()

    if (data.answers) {
      call.qualification_answers = JSON.stringify(data.answers)
    }

    await callRepo.save(call)

    // Deduct AI calling units (1 token per 60s)
    const minutes = Math.max(1, Math.ceil(data.durationSeconds / 60))
    await this.quotaService.incrementUsage(call.org_id, 'aiCalls', minutes)

    return call
  }
}
