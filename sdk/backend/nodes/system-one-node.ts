// sdk/backend/nodes/system-one-node.ts
// Pipeline node for OpenJev System-One probabilistic decision-making.
// Evaluates Choice, Score, and Noul questions across Local ONNX, Local GGUF, LAN, or Cloud API.

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  selectField,
  strField,
  mainOutput,
  mainInput,
  anySchema,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'
import { systemOneEngine } from '@sdk/core/decision'
import type { SystemOneMode, SystemOneQuestion } from '@sdk/core/decision'

export function registerSystemOneNode() {
  const handler: NodeHandler = {
    type: 'system_one_decision' as any,
    async execute(ctx) {
      const mode = (ctx.config.mode as SystemOneMode) || 'local_onnx'
      const modelId = (ctx.config.modelId as string) || 'Xenova/nli-deberta-v3-small'
      const prefix = ctx.config.decisionFieldPrefix !== undefined ? String(ctx.config.decisionFieldPrefix) : 'decision_'
      const lanEndpoint = ctx.config.lanEndpoint as string | undefined
      const apiKey = ctx.config.apiKey as string | undefined
      const questions = (ctx.config.questions as Record<string, SystemOneQuestion>) || {
        is_b2b: {
          type: 'noul',
          instructions: 'The target business sells products or services to other businesses rather than consumers.',
          threshold: 0.75,
        },
      }

      const approvedRecords: PipelineRecord[] = []
      const rejectedRecords: PipelineRecord[] = []
      const uncertainRecords: PipelineRecord[] = []
      const allRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        const recData = (rec && typeof rec.data === 'object' && rec.data !== null) ? rec.data : {}
        try {
          const response = await systemOneEngine.execute(recData, questions, {
            mode,
            modelId,
            lanEndpoint,
            apiKey,
          })

          const enrichedData: Record<string, unknown> = {
            ...recData,
            [`${prefix}model`]: response.modelId,
            [`${prefix}mode`]: response.mode,
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
              enrichedData[`${prefix}${qKey}_probs`] = d.probabilities
            } else if (d.type === 'score') {
              enrichedData[`${prefix}${qKey}`] = d.score
              enrichedData[`${prefix}${qKey}_normalized`] = d.normalizedScore
              enrichedData[`${prefix}${qKey}_conf`] = d.confidence
              if (d.level) enrichedData[`${prefix}${qKey}_level`] = d.level
            }
          }

          const enrichedRec: PipelineRecord = {
            ...rec,
            data: enrichedData,
          }

          allRecords.push(enrichedRec)

          if (response.isApproved) {
            approvedRecords.push(enrichedRec)
          } else if (response.uncertaintyScore > 0.45) {
            uncertainRecords.push(enrichedRec)
          } else {
            rejectedRecords.push(enrichedRec)
          }
        } catch (err: any) {
          const errorRec: PipelineRecord = {
            ...rec,
            data: {
              ...recData,
              [`${prefix}error`]: err?.message || String(err),
            },
          }
          allRecords.push(errorRec)
          uncertainRecords.push(errorRec)
        }
      }

      ctx.log(
        'info',
        `[SystemOneDecision] Evaluated ${allRecords.length} records (${approvedRecords.length} approved, ${rejectedRecords.length} rejected, ${uncertainRecords.length} uncertain) via ${mode} (${modelId})`
      )

      ctx.emit(allRecords, 'main')
      if (approvedRecords.length > 0) ctx.emit(approvedRecords, 'approved')
      if (rejectedRecords.length > 0) ctx.emit(rejectedRecords, 'rejected')
      if (uncertainRecords.length > 0) ctx.emit(uncertainRecords, 'uncertain')
    },
  }

  const descriptor = makeDescriptor({
    type: 'system_one_decision' as any,
    name: 'OpenJev Decision',
    description: 'Sub-second probabilistic decision-making (Choice, Score, Noul) with Local ONNX, Local GGUF, LAN, or Cloud API.',
    category: 'Process',
    icon: 'Brain',
    color: '#8B5CF6',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'approved', label: 'Approved (High Confidence)', schema: anySchema },
      { id: 'rejected', label: 'Rejected (Low Fit)', schema: anySchema },
      { id: 'uncertain', label: 'Uncertain (Ambiguous)', schema: anySchema },
    ],
    configSchema: {
      mode: selectField(
        'Engine Mode',
        ['local_onnx', 'local_gguf', 'lan', 'api'],
        'Execution mode: Local ONNX (Micro), Local GGUF (SLM), LAN server, or Cloud API',
        'local_onnx'
      ),
      modelId: strField(
        'Model ID',
        false,
        'Model identifier from catalog (e.g. Xenova/nli-deberta-v3-small, SmolLM2-135M, GPT-AGI/OpenJev-1.5B)',
        'Xenova/nli-deberta-v3-small'
      ),
      lanEndpoint: strField(
        'LAN Endpoint URL',
        false,
        'Address of local network GPU server (e.g. http://192.168.1.100:8000)',
        'http://localhost:8000'
      ),
      decisionFieldPrefix: strField(
        'Field Prefix',
        false,
        'Prefix for enriched decision attributes on the lead record',
        'decision_'
      ),
    },
    help: 'Evaluates code-defined questions against each prospect in a single forward pass.\n\nConnect the "Approved" port to downstream outreach or enrichment, and "Rejected" to exclusion lists.',
  })

  registerNode(handler, descriptor)
}
