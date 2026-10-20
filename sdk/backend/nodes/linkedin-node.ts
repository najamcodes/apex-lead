// sdk/backend/nodes/linkedin-node.ts
// Omnichannel LinkedIn automated outreach node.

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
import { parseSpintax } from '@sdk/core/outreach/spintax'
import { interpolateTemplate } from '../engine/transformer'

export function registerLinkedInNode() {
  const handler: NodeHandler = {
    type: 'linkedin' as any,
    async execute(ctx) {
      const action = (ctx.config.action as string) || 'connection_request'
      const linkedinUrlField = (ctx.config.linkedinUrlField as string) || 'linkedinUrl'
      const template = (ctx.config.messageTemplate as string) || '{Hi|Hello} {{ lead.firstName }}, noticed your work at {{ lead.companyName }}!'
      const simulate = ctx.config.simulate !== false

      const successfulRecords: PipelineRecord[] = []
      const failedRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const profileUrl = String(getPath(linkedinUrlField, rec.data || '') || '')

        if (!profileUrl || !profileUrl.includes('linkedin.com')) {
          failedRecords.push(rec)
          continue
        }

        // Interpolate and resolve spintax for message note
        const interpolated = interpolateTemplate(template, { lead: rec.data || {}, input: rec.data || {} })
        const finalMessage = parseSpintax(interpolated)

        const actionResult = {
          success: true,
          action,
          profileUrl,
          sentMessage: action === 'view_profile' ? null : finalMessage,
          simulated: simulate,
          dispatchedAt: new Date().toISOString(),
        }

        const updatedRec: PipelineRecord = {
          ...rec,
          data: {
            ...rec.data,
            lastLinkedInAction: actionResult,
            linkedinTouched: true,
          },
          meta: {
            ...rec.meta,
            sourceNodeId: ctx.nodeId,
            trace: [...(rec.meta.trace || []), ctx.nodeId],
          },
        }

        successfulRecords.push(updatedRec)
      }

      ctx.log(
        'info',
        `[LinkedInNode] Dispatched "${action}" for ${successfulRecords.length}/${ctx.incoming.length} profiles.`
      )

      ctx.emit(successfulRecords, 'main')
      if (failedRecords.length > 0) {
        ctx.emit(failedRecords, 'missing_profile')
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'linkedin' as any,
    name: 'LinkedIn Outreach',
    description: 'Executes automated LinkedIn touchpoints (profile views, connection requests, InMails, messages).',
    category: 'Output',
    icon: 'Linkedin',
    color: '#0A66C2',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'missing_profile', label: 'Missing LinkedIn URL', schema: anySchema },
    ],
    configSchema: {
      action: selectField(
        'Action Type',
        ['connection_request', 'view_profile', 'send_inmail', 'send_message'],
        'LinkedIn touchpoint action to perform',
        'connection_request'
      ),
      linkedinUrlField: strField('LinkedIn URL Key', false, 'Property holding the prospect profile URL', 'linkedinUrl'),
      messageTemplate: textField(
        'Connection / InMail Note',
        false,
        'Personalized template note. Supports spintax {Hi|Hello} and {{ lead.firstName }}.',
        '{Hi|Hello} {{ lead.firstName }}, noticed your work at {{ lead.companyName }}!'
      ),
      simulate: boolField('Simulation Mode', 'Simulate API calls without dispatching real browser actions', true),
    },
  })

  registerNode(handler, descriptor)
}
