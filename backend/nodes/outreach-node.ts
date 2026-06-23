// backend/nodes/outreach-node.ts
// Schedules/sends outreach sequences via the outreach engine.

import { registerNode } from '../engine/registry'
import { makeDescriptor, selectField, strField, boolField, mainOutput, mainInput } from './descriptors'
import type { NodeHandler } from '../engine/types'

export function registerOutreachNode() {
  const handler: NodeHandler = {
    type: 'outreach',
    async execute(ctx) {
      const requireEmail = (ctx.config.require_email as boolean) ?? true
      const templateId = ctx.config.template_id as number | undefined
      const sendImmediately = (ctx.config.send_immediately as boolean) ?? false
      const subject = ctx.config.subject as string | undefined
      const body = ctx.config.body as string | undefined

      const { createSequenceForLead } = await import('../core/outreach')
      const { logActivity } = await import('../db/queries/activity.queries')
      const { getDataSource } = await import('../db')
      const { LeadEntity } = await import('../db/entities/LeadEntity')

      let scheduled = 0, skipped = 0
      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        const email = rec.data.email as string | undefined
        const leadId = rec.data.id as number | undefined
        const businessName = (rec.data.business_name as string) || 'your business'

        if (requireEmail && !email) { skipped++; continue }
        if (!leadId) { skipped++; continue }

        try {
          // Verify the lead exists in the leads collection (for now, outreach is lead-coupled)
          const lead = await getDataSource().getRepository(LeadEntity).findOneBy({ id: leadId })
          if (!lead) { skipped++; continue }

          let seqSubject = subject || 'Quick question'
          let seqBody = body || 'Hi {{business_name}}, ...'

          // Substitute {{field}} from record data
          seqSubject = seqSubject.replace(/\{\{([^}]+)\}\}/g, (_, k: string) => String(rec.data[k.trim()] ?? ''))
          seqBody = seqBody.replace(/\{\{([^}]+)\}\}/g, (_, k: string) => String(rec.data[k.trim()] ?? ''))

          await createSequenceForLead({
            lead_id: leadId,
            email: email!,
            subject: seqSubject,
            email_body: seqBody,
            send_immediately: sendImmediately,
          }, businessName)
          await logActivity(leadId, 'sequence_started', `Pipeline ${ctx.pipelineId} scheduled outreach`)
          scheduled++
          ctx.emit(rec)
        } catch (err) {
          ctx.log('error', `Outreach scheduling failed for lead ${leadId}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      ctx.log('info', `Outreach: ${scheduled} scheduled, ${skipped} skipped`)
    },
  }

  const descriptor = makeDescriptor({
    type: 'outreach',
    name: 'Outreach',
    description: 'Schedules or sends email outreach sequences via the built-in outreach engine.',
    category: 'Output',
    icon: 'Mail',
    color: '#ef4444',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      template_id: strField('Template ID', false, 'Optional email template id to use.'),
      subject: strField('Subject', false, 'Email subject. Supports {{field}} substitution from record data.'),
      body: strField('Body', false, 'Email body. Supports {{field}} substitution.'),
      require_email: boolField('Require email', 'Skip records without an email address.', true),
      send_immediately: boolField('Send immediately', 'Send now instead of scheduling for the sequence cadence.'),
    },
    help: 'Currently requires records to reference existing leads (by id). Records pass through unchanged after scheduling.',
  })

  registerNode(handler, descriptor)
}
