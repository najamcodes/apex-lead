// backend/nodes/approval-node.ts
// Human-in-the-Loop Approval Node: pauses pipeline execution at critical checkpoints until an operator reviews, edits, and approves.

import type { NodeExecutionContext, NodeHandler } from '../engine/types'
import { registerNode } from '../engine/registry'
import { getDataSource } from '../db'
import { ApprovalEntity } from '../db/entities/ApprovalEntity'
import type { PipelineRecord } from '../../shared/types/pipeline.types'

export function registerApprovalNode(): void {
  const handler: NodeHandler = {
    type: 'approval',
    async execute(ctx: NodeExecutionContext): Promise<void> {
      if (ctx.incoming.length === 0) return

      const timeoutMinutes = Math.max(1, parseInt(String(ctx.config.timeout_minutes || '60'), 10))
      const timeoutMs = timeoutMinutes * 60 * 1000
      const timeoutAction = (ctx.config.timeout_action as string) || 'reject'
      const customMessage = (ctx.config.message as string) || 'Pipeline execution requires human approval before proceeding.'
      const webhookUrl = (ctx.config.webhook_url as string) || ''

      const ds = getDataSource()
      const approvalRepo = ds.getRepository(ApprovalEntity)

      // Save pending approval checkpoint to DB
      const approvalRecord = approvalRepo.create({
        org_id: ctx.orgId,
        pipeline_id: ctx.pipelineId,
        run_id: ctx.runId,
        node_id: ctx.nodeId,
        node_label: (ctx.config.label as string) || 'Human Approval',
        records: JSON.stringify(ctx.incoming),
        status: 'pending',
        reviewer_notes: customMessage,
      })
      await approvalRepo.save(approvalRecord)

      ctx.log('warn', `⏸️ Pipeline PAUSED at Approval Node [${approvalRecord.node_label}] (Approval ID: ${approvalRecord.id}). Waiting for human operator review...`)

      // Optional webhook notification (Slack/Discord/Custom)
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `⚠️ **Action Required**: Pipeline approval pending for Run \`${ctx.runId.slice(0, 8)}\` (${ctx.incoming.length} records).`,
              approvalId: approvalRecord.id,
              pipelineId: ctx.pipelineId,
              runId: ctx.runId,
              recordCount: ctx.incoming.length,
              sampleData: ctx.incoming.slice(0, 3).map(r => r.data),
              message: customMessage,
            }),
          })
        } catch (err: any) {
          ctx.log('warn', `Approval webhook notification failed: ${err.message}`)
        }
      }

      // Wait / poll loop for human approval
      const startTime = Date.now()
      let approved = false
      let rejected = false
      let finalRecords: PipelineRecord[] = ctx.incoming

      while (Date.now() - startTime < timeoutMs) {
        if (ctx.isCancelled()) {
          approvalRecord.status = 'rejected'
          approvalRecord.reviewer_notes = 'Cancelled by user / pipeline stop'
          await approvalRepo.save(approvalRecord)
          return
        }

        const latest = await approvalRepo.findOneBy({ id: approvalRecord.id })
        if (latest) {
          if (latest.status === 'approved') {
            approved = true
            if (latest.modified_records) {
              try {
                finalRecords = JSON.parse(latest.modified_records)
              } catch {}
            }
            break
          } else if (latest.status === 'rejected') {
            rejected = true
            break
          }
        }

        // Check every 1.5 seconds
        await new Promise(r => setTimeout(r, 1500))
      }

      if (approved) {
        ctx.log('info', `✅ Human Approval GRANTED (Approval ID: ${approvalRecord.id}). Resuming pipeline...`)
        ctx.emit(finalRecords, 'approved')
      } else if (rejected) {
        ctx.log('warn', `❌ Human Approval REJECTED (Approval ID: ${approvalRecord.id}). Routing to rejected port.`)
        ctx.emit(finalRecords, 'rejected')
      } else {
        // Timed out
        ctx.log('error', `⏰ Human Approval TIMED OUT after ${timeoutMinutes} minutes. Action: ${timeoutAction}`)
        approvalRecord.status = 'timeout'
        await approvalRepo.save(approvalRecord)

        if (timeoutAction === 'proceed') {
          ctx.emit(ctx.incoming, 'approved')
        } else {
          ctx.emit(ctx.incoming, 'rejected')
        }
      }
    },
  }

  const descriptor = {
    type: 'approval' as const,
    name: 'Human Approval Checkpoint',
    description: 'Pauses pipeline execution, alerts an operator via Webhook/UI, and resumes only when approved with optional edits.',
    category: 'Logic' as const,
    icon: 'ShieldCheck',
    color: '#f59e0b',
    isStart: false,
    inputs: [
      {
        id: 'main',
        label: 'Input Records',
        schema: { fields: {}, multiple: true, description: 'Records to review before proceeding' },
      },
    ],
    outputs: [
      {
        id: 'approved',
        label: 'Approved Stream',
        schema: { fields: {}, multiple: true, description: 'Records approved by human operator' },
      },
      {
        id: 'rejected',
        label: 'Rejected Stream',
        schema: { fields: {}, multiple: true, description: 'Records rejected by human operator' },
      },
    ],
    produces: true,
    configSchema: {
      message: {
        type: 'string',
        label: 'Review Instructions',
        description: 'Instructions shown to the operator reviewing these records',
        default: 'Please inspect email copy, AI lead score, and verified details before dispatching outreach.',
      },
      timeout_minutes: {
        type: 'number',
        label: 'Timeout (Minutes)',
        description: 'How long to wait before automatic timeout action is taken',
        default: 120,
      },
      timeout_action: {
        type: 'select',
        label: 'Action on Timeout',
        options: [
          { label: 'Reject / Stop (Safe)', value: 'reject' },
          { label: 'Auto-Approve & Proceed', value: 'proceed' },
        ],
        default: 'reject',
      },
      webhook_url: {
        type: 'string',
        label: 'Alert Webhook URL (Slack/Discord)',
        description: 'Optional webhook endpoint to send notifications when approval is pending',
      },
    },
  }

  registerNode(handler, descriptor)
}
