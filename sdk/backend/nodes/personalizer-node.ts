// sdk/backend/nodes/personalizer-node.ts
// Crafts hyper-personalized 1-to-1 cold outreach icebreakers, growth hooks, and P.S. lines.

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  strField,
  selectField,
  mainOutput,
  mainInput,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'
import { resolveSpintax } from '@sdk/core/outreach/spintax'

export function generateIcebreaker(
  data: Record<string, any>,
  tone: 'conversational' | 'direct' | 'consultative' | 'growth_focused' = 'conversational'
): { icebreaker: string; psLine: string; angle: string } {
  const fName = data.firstName || data.name?.split(' ')[0] || 'there'
  const company = data.companyName || data.company || 'your team'
  const title = data.title || data.jobTitle || ''
  const isDirect = tone === 'direct'

  // 1. Hiring Velocity Angle (Highest conversion)
  const openJobs = Number(data.openJobsCount || data.openRolesCount || 0)
  if (openJobs > 0) {
    const roles = Array.isArray(data.topOpenRoles) ? data.topOpenRoles.slice(0, 2).join(' & ') : ''
    const roleSnippet = roles ? ` (${roles})` : ''
    const templates = [
      `{Saw|Noticed|Loved seeing} that ${company} is actively scaling with ${openJobs} open roles right now${roleSnippet} — exciting growth trajectory!`,
      `Saw you're expanding the team at ${company} with ${openJobs} open positions — huge kudos on the hiring momentum.`,
      `Noticed ${company} has ${openJobs} open roles and is hiring aggressively right now — congrats on scaling the team!`,
    ]
    const chosen = templates[Math.floor(Math.random() * templates.length)]
    return {
      icebreaker: resolveSpintax(chosen),
      psLine: `P.S. Good luck filling the open ${roles || 'headcount'} at ${company}!`,
      angle: 'hiring_intent',
    }
  }

  // 2. Technographic Angle
  if (Array.isArray(data.technologies) && data.technologies.length > 0) {
    const techSample = data.technologies.slice(0, 2).join(' and ')
    const templates = [
      `{Noticed|Saw} your team at ${company} is running on ${techSample} — great modern stack.`,
      `Saw you folks are utilizing ${techSample} at ${company} — always admire teams optimizing their infrastructure.`,
      `Caught that ${company} uses ${techSample} — wanted to reach out specifically because we integrate seamlessly with that workflow.`,
    ]
    const chosen = templates[Math.floor(Math.random() * templates.length)]
    return {
      icebreaker: resolveSpintax(chosen),
      psLine: `P.S. How has your experience been scaling with ${data.technologies[0]} recently?`,
      angle: 'technographic',
    }
  }

  // 3. News & Funding Trigger Angle
  if (Array.isArray(data.newsEvents) && data.newsEvents.length > 0) {
    const event = data.newsEvents[0]
    const titleSnippet = typeof event === 'object' && event.title ? event.title : 'recent company milestones'
    const templates = [
      `{Huge congratulations on|Saw the exciting announcement regarding} ${titleSnippet} at ${company}!`,
      `Caught the recent news about ${company} (${titleSnippet}) — awesome milestone.`,
    ]
    const chosen = templates[Math.floor(Math.random() * templates.length)]
    return {
      icebreaker: resolveSpintax(chosen),
      psLine: `P.S. Congrats again to everyone at ${company} on the recent announcement!`,
      angle: 'news_funding',
    }
  }

  // 4. Role & Domain Authority Angle (Fallback)
  if (title) {
    const templates = [
      `{Loved your focus as|Noticed your leadership as} ${title} at ${company} — wanted to share a quick idea relevant to your mandate.`,
      `Given your role spearheading ${title} at ${company}, thought this would be directly relevant to your quarterly priorities.`,
      `Reached out because of your work leading ${title} initiatives at ${company}.`,
    ]
    const chosen = templates[Math.floor(Math.random() * templates.length)]
    return {
      icebreaker: resolveSpintax(chosen),
      psLine: `P.S. Would love to hear how ${company} is prioritizing initiatives this quarter.`,
      angle: 'role_authority',
    }
  }

  // 5. General Clean Hook
  const greeting = isDirect
    ? `{Hi|Hello} ${fName} — reaching out directly regarding ${company}.`
    : `{Hope you're having a productive week|Hope things are going great with you}, ${fName}! at ${company}`
  return {
    icebreaker: resolveSpintax(greeting),
    psLine: `P.S. Rooting for your continued success at ${company}.`,
    angle: 'general',
  }
}

export function registerPersonalizerNode() {
  const handler: NodeHandler = {
    type: 'personalizer' as any,
    async execute(ctx) {
      const tone = (ctx.config.tone as any) || 'conversational'
      const outputField = (ctx.config.outputField as string) || 'icebreaker'
      const psField = (ctx.config.psField as string) || 'psLine'

      const outputRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const personalization = generateIcebreaker(rec.data, tone)

        const updatedData: Record<string, unknown> = {
          ...rec.data,
          [outputField]: personalization.icebreaker,
          [psField]: personalization.psLine,
          personalizationAngle: personalization.angle,
          personalizedHook: `${personalization.icebreaker}\n\n${rec.data.outreachBody || ''}\n\n${personalization.psLine}`,
        }

        outputRecords.push({
          ...rec,
          data: updatedData,
          meta: {
            ...rec.meta,
            sourceNodeId: ctx.nodeId,
            trace: [...(rec.meta.trace || []), ctx.nodeId],
          },
        })
      }

      ctx.log(
        'info',
        `[PersonalizerNode] Generated personalized outreach hooks for ${outputRecords.length} records.`
      )

      ctx.emit(outputRecords, 'main')
    },
  }

  const descriptor = makeDescriptor({
    type: 'personalizer' as any,
    name: 'AI & Intent Personalizer',
    description: 'Generates tailored 1-to-1 cold outreach opening lines and hooks from hiring signals, tech stack, and recent news.',
    category: 'Process',
    icon: 'MessageSquareText',
    color: '#EC4899',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      tone: selectField(
        'Tone of Voice',
        ['conversational', 'direct', 'consultative', 'growth_focused'],
        'Tone style for generated opening hooks',
        'conversational'
      ),
      outputField: strField('Icebreaker Output Key', false, 'Property name for icebreaker hook', 'icebreaker'),
      psField: strField('P.S. Line Output Key', false, 'Property name for P.S. hook', 'psLine'),
    },
    help: 'Dynamically synthesizes personalized opening lines using intent triggers (e.g. open jobs from career radar, detected tech stack, recent funding news).\n\nInjects {{record.icebreaker}} into email or LinkedIn touchpoints.',
  })

  registerNode(handler, descriptor)
}
