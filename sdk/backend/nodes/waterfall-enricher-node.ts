// sdk/backend/nodes/waterfall-enricher-node.ts
// Multi-vendor cascading email & phone discovery and verification node.

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  strField,
  numField,
  boolField,
  mainOutput,
  mainInput,
  anySchema,
  getPath,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'
import { waterfallEnrichmentService } from '@sdk/core/enrichment/waterfall-engine'

export function registerWaterfallEnricherNode() {
  const handler: NodeHandler = {
    type: 'waterfall_enricher' as any,
    async execute(ctx) {
      const fNameField = (ctx.config.firstNameField as string) || 'firstName'
      const lNameField = (ctx.config.lastNameField as string) || 'lastName'
      const compField = (ctx.config.companyField as string) || 'companyName'
      const domField = (ctx.config.domainField as string) || 'domain'
      const emailField = (ctx.config.emailField as string) || 'email'
      const phoneField = (ctx.config.phoneField as string) || 'phone'

      const enrichPhone = Boolean(ctx.config.enrichPhone)
      const minThreshold = Number(ctx.config.minScoreThreshold ?? 60)
      const stopOnFirstVerified = ctx.config.stopOnFirstVerified !== false

      const verifiedRecords: PipelineRecord[] = []
      const unverifiedRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const fName = String(getPath(fNameField, rec.data || '') || '')
        const lName = String(getPath(lNameField, rec.data || '') || '')
        const company = String(getPath(compField, rec.data || '') || '')
        const domain = String(getPath(domField, rec.data || '') || '')
        const existingEmail = String(getPath(emailField, rec.data || '') || '')
        const existingPhone = String(getPath(phoneField, rec.data || '') || '')

        const result = await waterfallEnrichmentService.cascadeEnrich(
          {
            firstName: fName,
            lastName: lName,
            company,
            domain,
            email: existingEmail || undefined,
            phone: existingPhone || undefined,
          },
          {
            enrichPhone,
            minScoreThreshold: minThreshold,
            stopOnFirstVerified,
          }
        )

        const updatedData: Record<string, unknown> = {
          ...rec.data,
          email: result.email || existingEmail || null,
          phone: result.phone || existingPhone || null,
          phoneType: result.phoneType || null,
          enrichmentScore: result.score,
          emailVerified: result.verified,
          winningEmailProvider: result.winningEmailProvider,
          winningPhoneProvider: result.winningPhoneProvider,
          waterfallTrace: result.waterfallTrace,
          costCreditsSaved: result.costCreditsSaved,
        }

        const enrichedRecord: PipelineRecord = {
          ...rec,
          data: updatedData,
          meta: {
            ...rec.meta,
            sourceNodeId: ctx.nodeId,
            trace: [...(rec.meta.trace || []), ctx.nodeId],
          },
        }

        if (result.verified && result.score >= minThreshold) {
          verifiedRecords.push(enrichedRecord)
        } else {
          unverifiedRecords.push(enrichedRecord)
        }
      }

      ctx.log(
        'info',
        `[WaterfallEnricher] Processed ${ctx.incoming.length} records. Verified: ${verifiedRecords.length}, Unverified: ${unverifiedRecords.length}`
      )

      // Emit on main port
      ctx.emit([...verifiedRecords, ...unverifiedRecords], 'main')

      // Emit unverified records separately if subscribed
      if (unverifiedRecords.length > 0) {
        ctx.emit(unverifiedRecords, 'unverified')
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'waterfall_enricher' as any,
    name: 'Waterfall Enricher',
    description: 'Cascading multi-vendor email & phone discovery with MX catch-all verification and credit optimization.',
    category: 'Process',
    icon: 'Layers',
    color: '#06B6D4',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'unverified', label: 'Unverified / Risky', schema: anySchema },
    ],
    configSchema: {
      firstNameField: strField('First Name Key', false, 'Property holding contact first name', 'firstName'),
      lastNameField: strField('Last Name Key', false, 'Property holding contact last name', 'lastName'),
      companyField: strField('Company Name Key', false, 'Property holding company name', 'companyName'),
      domainField: strField('Domain Key', false, 'Property holding company website or domain', 'domain'),
      emailField: strField('Email Key', false, 'Property holding existing email to check', 'email'),
      enrichPhone: boolField('Enrich Phone Number', 'Discover mobile or direct-dial phone number', false),
      minScoreThreshold: numField('Minimum Confidence Score', false, 'Minimum score (0-100) to accept lead', 60),
      stopOnFirstVerified: boolField('Stop On First Verified', 'Halt cascade once a verified email is found to save API credits', true),
    },
  })

  registerNode(handler, descriptor)
}
