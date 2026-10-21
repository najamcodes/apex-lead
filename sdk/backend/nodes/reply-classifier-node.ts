// sdk/backend/nodes/reply-classifier-node.ts
// Pipeline node for intelligent inbound email reply sentiment, intent categorization, and auto-routing.
// Categorizes replies into: positive (meeting/demo), referral, out_of_office, not_interested, or neutral.

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  strField,
  boolField,
  mainOutput,
  mainInput,
  anySchema,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'
import { classifyReplySentiment } from '@sdk/core/outreach/sentiment-classifier'

export function registerReplyClassifierNode() {
  const handler: NodeHandler = {
    type: 'reply_classifier' as any,
    async execute(ctx) {
      const textField = (ctx.config.textField as string) || 'body'
      const autoTag = ctx.config.autoTag !== false
      const prefix = ctx.config.fieldPrefix !== undefined ? String(ctx.config.fieldPrefix) : 'reply_'

      const positiveRecords: PipelineRecord[] = []
      const referralRecords: PipelineRecord[] = []
      const oooRecords: PipelineRecord[] = []
      const negativeRecords: PipelineRecord[] = []
      const neutralRecords: PipelineRecord[] = []
      const allRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const recData = (rec && typeof rec.data === 'object' && rec.data !== null) ? rec.data : {}
        const text = String(recData[textField] || recData.text || recData.message || recData.snippet || '').trim()

        const result = classifyReplySentiment(text)

        // Check for referral patterns (e.g., "speak to my colleague", "reach out to Jane")
        const isReferral = /\b(?:reach out to|talk to|speak (?:with|to)|contact|forwarded to|refer you to|looping in)\b/i.test(text)
        const classification = isReferral ? 'referral' : result.classification

        const enrichedData: Record<string, unknown> = {
          ...recData,
          [`${prefix}classification`]: classification,
          [`${prefix}confidence`]: result.confidence,
          [`${prefix}should_halt`]: result.shouldHaltSequence || isReferral,
          [`${prefix}is_positive`]: classification === 'positive',
          [`${prefix}is_referral`]: isReferral,
          [`${prefix}is_ooo`]: classification === 'ooo',
          [`${prefix}is_negative`]: classification === 'negative',
        }

        if (autoTag) {
          const tags = Array.isArray(recData.tags) ? [...recData.tags] : []
          if (!tags.includes(`reply:${classification}`)) {
            tags.push(`reply:${classification}`)
          }
          enrichedData.tags = tags
        }

        const enrichedRec: PipelineRecord = {
          ...rec,
          data: enrichedData,
          meta: {
            ...rec.meta,
            sourceNodeId: ctx.nodeId,
            trace: [...(rec.meta?.trace || []), ctx.nodeId],
          },
        }

        allRecords.push(enrichedRec)

        switch (classification) {
          case 'positive':
            positiveRecords.push(enrichedRec)
            break
          case 'referral':
            referralRecords.push(enrichedRec)
            break
          case 'ooo':
            oooRecords.push(enrichedRec)
            break
          case 'negative':
            negativeRecords.push(enrichedRec)
            break
          default:
            neutralRecords.push(enrichedRec)
            break
        }
      }

      ctx.log(
        'info',
        `[ReplyClassifier] Evaluated ${allRecords.length} replies: ${positiveRecords.length} positive, ${referralRecords.length} referral, ${oooRecords.length} OOO, ${negativeRecords.length} negative/unsubscribe`
      )

      ctx.emit(allRecords, 'main')
      if (positiveRecords.length > 0) ctx.emit(positiveRecords, 'positive')
      if (referralRecords.length > 0) ctx.emit(referralRecords, 'referral')
      if (oooRecords.length > 0) ctx.emit(oooRecords, 'ooo')
      if (negativeRecords.length > 0) ctx.emit(negativeRecords, 'negative')
    },
  }

  const descriptor = makeDescriptor({
    type: 'reply_classifier' as any,
    name: 'Reply Classifier & Intent Router',
    description: 'Analyzes incoming cold outreach replies using NLP sentiment and intent models, routing leads to meeting booking, CRM updates, or unsubscribe handling.',
    category: 'Process',
    icon: 'MailCheck',
    color: '#10B981',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'positive', label: 'Positive / Meeting Request', schema: anySchema },
      { id: 'referral', label: 'Colleague Referral', schema: anySchema },
      { id: 'ooo', label: 'Out of Office', schema: anySchema },
      { id: 'negative', label: 'Negative / Unsubscribe', schema: anySchema },
    ],
    configSchema: {
      textField: strField('Text Content Key', false, 'Field containing reply body or snippet', 'body'),
      fieldPrefix: strField('Result Field Prefix', false, 'Prefix for generated sentiment fields', 'reply_'),
      autoTag: boolField('Auto Tag Records', 'Automatically append reply classification to record tags', true),
    },
  })

  registerNode(handler, descriptor)
}
