// electron/outreach/connector-hook.ts
// Fires connector plugins at lead lifecycle and outreach event points.
// Called from the outreach sequence engine and lead status change handlers.

import type { PluginTrigger } from '../../../plugins/types'
import { fireConnectors, makeLeadSnapshot } from '../../../plugins/runner'
import { getDataSource } from '../../db'
import { LeadEntity } from '../../db/entities/LeadEntity'

/**
 * Fire connector plugins for a lead lifecycle event.
 * Safe to call without awaiting — errors are logged and swallowed.
 *
 * @param trigger  - The event type (e.g. 'lead.approved')
 * @param leadId   - The lead that triggered the event
 * @param metadata - Optional context (e.g. outreach step, reply body)
 */
export async function fireLeadEvent(
  trigger: PluginTrigger,
  leadId: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const lead = await getDataSource()
      .getRepository(LeadEntity)
      .findOneBy({ id: leadId })

    if (!lead) {
      console.warn(`[connector-hook] Lead ${leadId} not found for trigger '${trigger}'`)
      return
    }

    const snapshot = makeLeadSnapshot(lead as unknown as Record<string, unknown>)
    const { fired, errors } = await fireConnectors(trigger, snapshot, metadata)

    if (fired > 0 || errors > 0) {
      console.log(`[connector-hook] '${trigger}' for lead ${leadId}: ${fired} fired, ${errors} errors`)
    }
  } catch (err) {
    // Never let connector failures surface to callers
    console.error(`[connector-hook] Unexpected error for trigger '${trigger}' on lead ${leadId}:`, err)
  }
}

/**
 * Convenience wrappers for the most common triggers.
 */
export const connectorHook = {
  leadCreated:     (leadId: number) => fireLeadEvent('lead.created',    leadId),
  leadQualified:   (leadId: number) => fireLeadEvent('lead.qualified',  leadId),
  leadApproved:    (leadId: number) => fireLeadEvent('lead.approved',   leadId),
  leadSkipped:     (leadId: number) => fireLeadEvent('lead.skipped',    leadId),
  leadClosed:      (leadId: number) => fireLeadEvent('lead.closed',     leadId),
  outreachSent:    (leadId: number, step: number, channel: string) =>
    fireLeadEvent('outreach.sent',    leadId, { step, channel }),
  outreachReplied: (leadId: number, intent?: string, summary?: string, replyBody?: string) =>
    fireLeadEvent('outreach.replied', leadId, { intent, summary, reply_body: replyBody }),
  outreachBounced: (leadId: number) => fireLeadEvent('outreach.bounced', leadId),
}
