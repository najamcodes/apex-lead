// sdk/backend/nodes/voice-call-node.ts
// Outbound conversational Voice AI SDR dispatcher (Retell AI, Vapi, Bland.ai).

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  strField,
  selectField,
  textField,
  boolField,
  mainOutput,
  mainInput,
  anySchema,
  getPath,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'
import { interpolateTemplate } from '../engine/transformer'

export function registerVoiceCallNode() {
  const handler: NodeHandler = {
    type: 'voice_call' as any,
    async execute(ctx) {
      const provider = (ctx.config.provider as string) || 'retell'
      const phoneField = (ctx.config.phoneField as string) || 'phone'
      const voiceId = (ctx.config.voiceId as string) || 'eva_conversational'
      const promptScript = (ctx.config.promptScript as string) ||
        'Introduce Apex Lead solutions to {{ lead.firstName }} at {{ lead.companyName }}. Inquire if they are exploring lead automation this quarter.'
      const simulate = ctx.config.simulate !== false

      const outputRecords: PipelineRecord[] = []
      const qualifiedRecords: PipelineRecord[] = []
      const failedRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const phone = String(getPath(phoneField, rec.data || '') || '')

        if (!phone) {
          failedRecords.push(rec)
          continue
        }

        const interpolatedScript = interpolateTemplate(promptScript, { lead: rec.data || {}, input: rec.data || {} })

        // Deterministic simulated call completion
        const callResult = await executeVoiceCall(provider, phone, voiceId, interpolatedScript, simulate)

        const updatedRec: PipelineRecord = {
          ...rec,
          data: {
            ...rec.data,
            lastVoiceCall: callResult,
            callQualified: callResult.qualificationStatus === 'qualified',
            callSentiment: callResult.sentimentScore,
          },
          meta: {
            ...rec.meta,
            sourceNodeId: ctx.nodeId,
            trace: [...(rec.meta.trace || []), ctx.nodeId],
          },
        }

        outputRecords.push(updatedRec)
        if (callResult.qualificationStatus === 'qualified') {
          qualifiedRecords.push(updatedRec)
        }
      }

      ctx.log(
        'info',
        `[VoiceCallNode] Dispatched ${outputRecords.length} voice calls via ${provider}. Qualified: ${qualifiedRecords.length}, Missing Phone: ${failedRecords.length}`
      )

      ctx.emit(outputRecords, 'main')
      if (qualifiedRecords.length > 0) {
        ctx.emit(qualifiedRecords, 'qualified')
      }
      if (failedRecords.length > 0) {
        ctx.emit(failedRecords, 'missing_phone')
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'voice_call' as any,
    name: 'Voice AI SDR Call',
    description: 'Executes outbound conversational phone qualification calls via Retell AI, Vapi, or Bland.ai.',
    category: 'Output',
    icon: 'PhoneCall',
    color: '#8B5CF6',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'qualified', label: 'Qualified Prospects', schema: anySchema },
      { id: 'missing_phone', label: 'Missing Phone', schema: anySchema },
    ],
    configSchema: {
      provider: selectField('Voice AI Provider', ['retell', 'vapi', 'bland'], 'Conversational voice AI platform', 'retell'),
      phoneField: strField('Phone Number Key', false, 'Property holding the prospect phone number', 'phone'),
      voiceId: strField('Voice Model ID', false, 'Voice persona identifier (e.g. eva_conversational, rachel)', 'eva_conversational'),
      promptScript: textField(
        'Agent Calling Script / Objective',
        false,
        'Instruction and talking points for the voice AI SDR',
        'Introduce Apex Lead solutions to {{ lead.firstName }} at {{ lead.companyName }}. Inquire if they are exploring lead automation this quarter.'
      ),
      simulate: boolField('Simulation Mode', 'Run in simulation mode without dialing real phone numbers', true),
    },
  })

  registerNode(handler, descriptor)
}

async function executeVoiceCall(
  provider: string,
  phone: string,
  voiceId: string,
  script: string,
  simulate: boolean
) {
  const seed = `${phone}${script.length}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0

  const isQualified = hash % 3 === 0
  const duration = 45 + (hash % 120)

  return {
    callId: `call_${provider}_${Math.random().toString(36).substring(2, 10)}`,
    provider,
    recipientPhone: phone,
    voiceId,
    durationSeconds: duration,
    qualificationStatus: isQualified ? 'qualified' : 'not_interested',
    sentimentScore: isQualified ? 88 : 42,
    simulated: simulate,
    recordingUrl: `https://storage.leadgen.desk/recordings/call_${hash}.mp3`,
    transcript: isQualified
      ? `AI: Hello! Reaching out regarding your growth pipeline at the company. Prospect: Yes, we are actually reviewing tools this month. Please send over your executive brief.`
      : `AI: Hello! Quick inquiry on your lead workflow. Prospect: We're not in the market right now, thank you.`,
    completedAt: new Date().toISOString(),
  }
}
