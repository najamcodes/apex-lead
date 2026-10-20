// sdk/backend/nodes/decision-cascade-node.ts
// Pipeline node for the 4-Tier Decision Cascade.
// Funnels leads through Tier 0 (Rules) -> Tier 1 (NLI) -> Tier 2 (SLM) -> Tier 3 (Cloud LLM Fallback).
// Emits approved vs rejected leads and live resolution telemetry with cost savings metrics.

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
import { decisionCascadeEngine } from '@sdk/core/decision'
import type { CascadePolicy, Tier0Rule, SystemOneQuestion } from '@sdk/core/decision'

export function registerDecisionCascadeNode() {
  const handler: NodeHandler = {
    type: 'decision_cascade' as any,
    async execute(ctx) {
      const prefix = (ctx.config.decisionFieldPrefix as string) || 'cascade_'
      const tier0Rules = (ctx.config.tier0Rules as Tier0Rule[]) || [
        { field: 'email', operator: 'contains', value: '@gmail.com', outcome: 'reject', reason: 'Consumer email' },
        { field: 'email', operator: 'contains', value: '@yahoo.com', outcome: 'reject', reason: 'Consumer email' },
      ]
      const tier1ModelId = (ctx.config.tier1ModelId as string) || 'Xenova/nli-deberta-v3-small'
      const tier2ModelId = (ctx.config.tier2ModelId as string) || 'HuggingFaceTB/SmolLM2-135M-Instruct'
      const tier3FallbackEnabled = ctx.config.tier3FallbackEnabled === true
      const tier3ModelId = (ctx.config.tier3ModelId as string) || 'deepseek/deepseek-v4-flash'
      const questions = (ctx.config.questions as Record<string, SystemOneQuestion>) || {
        is_b2b_decision_maker: {
          type: 'noul',
          instructions: 'The target contact is an executive, founder, or key B2B decision maker.',
          threshold: 0.75,
        },
      }

      const policy: CascadePolicy = {
        tier0Rules,
        tier1ModelId,
        tier1HighThreshold: Number(ctx.config.tier1HighThreshold || 0.85),
        tier1LowThreshold: Number(ctx.config.tier1LowThreshold || 0.30),
        tier2ModelId,
        tier2HighThreshold: Number(ctx.config.tier2HighThreshold || 0.80),
        tier2LowThreshold: Number(ctx.config.tier2LowThreshold || 0.35),
        tier3FallbackEnabled,
        tier3ModelId,
        questions,
      }

      decisionCascadeEngine.resetTelemetry()

      const approvedRecords: PipelineRecord[] = []
      const rejectedRecords: PipelineRecord[] = []
      const allRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        try {
          const response = await decisionCascadeEngine.evaluate(rec.data, policy)

          const enrichedData: Record<string, unknown> = {
            ...rec.data,
            [`${prefix}tier_resolved`]: response.tierResolved,
            [`${prefix}model`]: response.modelId,
            [`${prefix}latency_ms`]: response.latencyMs,
            [`${prefix}uncertainty`]: response.uncertaintyScore,
            [`${prefix}approved`]: response.isApproved,
          }

          for (const [qKey, d] of Object.entries(response.decisions)) {
            if (d.type === 'noul') {
              enrichedData[`${prefix}${qKey}`] = d.value
              enrichedData[`${prefix}${qKey}_prob`] = d.probability
              enrichedData[`${prefix}${qKey}_conf`] = d.confidence
            } else if (d.type === 'choice') {
              enrichedData[`${prefix}${qKey}`] = d.selected
              enrichedData[`${prefix}${qKey}_conf`] = d.confidence
            } else if (d.type === 'score') {
              enrichedData[`${prefix}${qKey}`] = d.score
              enrichedData[`${prefix}${qKey}_conf`] = d.confidence
            }
          }

          const enrichedRec: PipelineRecord = {
            ...rec,
            data: enrichedData,
          }

          allRecords.push(enrichedRec)

          if (response.isApproved) {
            approvedRecords.push(enrichedRec)
          } else {
            rejectedRecords.push(enrichedRec)
          }
        } catch (err: any) {
          const errorRec: PipelineRecord = {
            ...rec,
            data: {
              ...rec.data,
              [`${prefix}error`]: err?.message || String(err),
            },
          }
          allRecords.push(errorRec)
          rejectedRecords.push(errorRec)
        }
      }

      const telemetry = decisionCascadeEngine.getTelemetry()
      ctx.log(
        'info',
        `[DecisionCascade] Funneled ${allRecords.length} records: T0=${telemetry.tier0Resolved}, T1=${telemetry.tier1Resolved}, T2=${telemetry.tier2Resolved}, T3=${telemetry.tier3Resolved}. Saved $${telemetry.estimatedCostSavingsUsd.toFixed(4)}.`
      )

      ctx.emit(allRecords, 'main')
      if (approvedRecords.length > 0) ctx.emit(approvedRecords, 'approved')
      if (rejectedRecords.length > 0) ctx.emit(rejectedRecords, 'rejected')

      // Emit summary telemetry record
      const telemetryRec: PipelineRecord = {
        id: `telemetry_${Date.now()}`,
        collection: 'telemetry',
        data: {
          type: 'decision_cascade_telemetry',
          ...telemetry,
          tier0Pct: telemetry.totalEvaluated > 0 ? Math.round((telemetry.tier0Resolved / telemetry.totalEvaluated) * 100) : 0,
          tier1Pct: telemetry.totalEvaluated > 0 ? Math.round((telemetry.tier1Resolved / telemetry.totalEvaluated) * 100) : 0,
          tier2Pct: telemetry.totalEvaluated > 0 ? Math.round((telemetry.tier2Resolved / telemetry.totalEvaluated) * 100) : 0,
          tier3Pct: telemetry.totalEvaluated > 0 ? Math.round((telemetry.tier3Resolved / telemetry.totalEvaluated) * 100) : 0,
        },
        meta: {
          pipelineId: ctx.pipelineId,
          runId: ctx.runId,
          sourceNodeId: ctx.nodeId,
          orgId: ctx.orgId,
          createdAt: new Date().toISOString(),
          trace: [ctx.nodeId],
        },
      }
      ctx.emit([telemetryRec], 'telemetry')
    },
  }

  const descriptor = makeDescriptor({
    type: 'decision_cascade' as any,
    name: 'Decision Cascade (4-Tier)',
    description: '4-Tier decision funnel: Tier 0 (Rules) -> Tier 1 (NLI) -> Tier 2 (SLM) -> Tier 3 (Cloud Fallback). Cuts 95% LLM cost.',
    category: 'Process',
    icon: 'Layers',
    color: '#6366F1',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'approved', label: 'Approved (High Confidence)', schema: anySchema },
      { id: 'rejected', label: 'Rejected (Disqualified)', schema: anySchema },
      { id: 'telemetry', label: 'Cascade Telemetry & Savings', schema: anySchema },
    ],
    configSchema: {
      tier1ModelId: strField(
        'Tier 1 Model (NLI)',
        false,
        'Ultra-fast micro-classifier (e.g. Xenova/nli-deberta-v3-small, ModernBERT)',
        'Xenova/nli-deberta-v3-small'
      ),
      tier2ModelId: strField(
        'Tier 2 Model (SLM)',
        false,
        'Compact Small Language Model (e.g. HuggingFaceTB/SmolLM2-135M-Instruct, Qwen2.5-0.5B)',
        'HuggingFaceTB/SmolLM2-135M-Instruct'
      ),
      tier3FallbackEnabled: boolField(
        'Enable Tier 3 Cloud Fallback',
        'Call cloud API (DeepSeek/Claude) only for remaining ambiguous edge cases',
        false
      ),
      tier3ModelId: strField(
        'Tier 3 Model',
        false,
        'Cloud LLM model ID (e.g. deepseek/deepseek-v4-flash, anthropic/claude-3-5-haiku)',
        'deepseek/deepseek-v4-flash'
      ),
      decisionFieldPrefix: strField(
        'Field Prefix',
        false,
        'Prefix for enriched attributes on lead records',
        'cascade_'
      ),
    },
    help: 'Cascades records through increasingly capable models only when confidence is ambiguous.\n\nOver 90% of leads resolve at Tier 0 and Tier 1 locally at zero cost.',
  })

  registerNode(handler, descriptor)
}
