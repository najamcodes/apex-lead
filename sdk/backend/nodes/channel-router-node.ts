// sdk/backend/nodes/channel-router-node.ts
// Omnichannel routing engine: routes leads to Voice AI, Email, or LinkedIn based on verified data.

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  selectField,
  boolField,
  mainOutput,
  mainInput,
  anySchema,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

export type OutreachChannel = 'email' | 'linkedin' | 'voice' | 'fallback'

export function registerChannelRouterNode() {
  const handler: NodeHandler = {
    type: 'channel_router' as any,
    async execute(ctx) {
      const primaryChannel = (ctx.config.primaryChannel as string) || 'email_first'
      const requireVerifiedEmail = ctx.config.requireVerifiedEmail !== false
      const requireMobileForVoice = ctx.config.requireMobileForVoice !== false

      const emailRecords: PipelineRecord[] = []
      const linkedinRecords: PipelineRecord[] = []
      const voiceRecords: PipelineRecord[] = []
      const fallbackRecords: PipelineRecord[] = []
      const allRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const d = rec.data || {}
        const email = String(d.email || '').trim()
        const isEmailVerified = Boolean(d.emailVerified || d.isDeliverable || (email && !requireVerifiedEmail))

        const phone = String(d.phone || d.phoneNumber || '').trim()
        const isMobile = d.phoneType === 'mobile' || !requireMobileForVoice
        const hasValidPhone = Boolean(phone && isMobile)

        const linkedinUrl = String(d.linkedinUrl || d.linkedin || '').trim()
        const hasLinkedIn = Boolean(linkedinUrl && linkedinUrl.includes('linkedin.com/'))

        let selected: OutreachChannel = 'fallback'

        if (primaryChannel === 'voice_first') {
          if (hasValidPhone) selected = 'voice'
          else if (email && isEmailVerified) selected = 'email'
          else if (hasLinkedIn) selected = 'linkedin'
          else selected = 'fallback'
        } else if (primaryChannel === 'linkedin_first') {
          if (hasLinkedIn) selected = 'linkedin'
          else if (email && isEmailVerified) selected = 'email'
          else if (hasValidPhone) selected = 'voice'
          else selected = 'fallback'
        } else {
          // Default: email_first
          if (email && isEmailVerified) selected = 'email'
          else if (hasLinkedIn) selected = 'linkedin'
          else if (hasValidPhone) selected = 'voice'
          else selected = 'fallback'
        }

        const updatedData: Record<string, unknown> = {
          ...d,
          selectedChannel: selected,
          channelRoutingReason: `Routed to ${selected} (emailVerified=${isEmailVerified}, phone=${hasValidPhone}, linkedin=${hasLinkedIn})`,
        }

        const enrichedRec: PipelineRecord = {
          ...rec,
          data: updatedData,
          meta: {
            ...rec.meta,
            sourceNodeId: ctx.nodeId,
            trace: [...(rec.meta.trace || []), ctx.nodeId],
          },
        }

        allRecords.push(enrichedRec)

        switch (selected) {
          case 'email':
            emailRecords.push(enrichedRec)
            break
          case 'linkedin':
            linkedinRecords.push(enrichedRec)
            break
          case 'voice':
            voiceRecords.push(enrichedRec)
            break
          case 'fallback':
            fallbackRecords.push(enrichedRec)
            break
        }
      }

      ctx.log(
        'info',
        `[ChannelRouter] Routed ${allRecords.length} leads: ${emailRecords.length} Email, ${linkedinRecords.length} LinkedIn, ${voiceRecords.length} Voice AI, ${fallbackRecords.length} Fallback.`
      )

      ctx.emit(allRecords, 'main')
      if (emailRecords.length > 0) ctx.emit(emailRecords, 'email')
      if (linkedinRecords.length > 0) ctx.emit(linkedinRecords, 'linkedin')
      if (voiceRecords.length > 0) ctx.emit(voiceRecords, 'voice')
      if (fallbackRecords.length > 0) ctx.emit(fallbackRecords, 'fallback')
    },
  }

  const descriptor = makeDescriptor({
    type: 'channel_router' as any,
    name: 'Channel Router',
    description: 'Directs leads to the optimal touchpoint channel (Email, LinkedIn, Voice AI SDR) based on verified contact data.',
    category: 'Logic',
    icon: 'Split',
    color: '#F59E0B',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'email', label: 'Email Channel', schema: anySchema },
      { id: 'linkedin', label: 'LinkedIn Channel', schema: anySchema },
      { id: 'voice', label: 'Voice AI Channel', schema: anySchema },
      { id: 'fallback', label: 'Fallback / Incomplete', schema: anySchema },
    ],
    configSchema: {
      primaryChannel: selectField(
        'Priority Preference',
        ['email_first', 'voice_first', 'linkedin_first'],
        'Which channel to prioritize when multiple verified methods exist',
        'email_first'
      ),
      requireVerifiedEmail: boolField('Require Verified Email', 'Only route to email if emailVerified or deliverable is true', true),
      requireMobileForVoice: boolField('Require Mobile Phone for Voice', 'Only route to voice AI if phoneType is mobile', true),
    },
    help: 'Examines each lead and branches to the most effective channel.\n\nConnect the "Email Channel" port to Outreach, "LinkedIn Channel" to LinkedIn actions, and "Voice AI Channel" to automated phone calls.',
  })

  registerNode(handler, descriptor)
}
