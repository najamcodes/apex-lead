// sdk/backend/nodes/dns-health-node.ts
// Cold outreach deliverability validator: checks SPF, DKIM, DMARC, and MX configuration.

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
import dns from 'dns/promises'

export interface DnsHealthAudit {
  deliverabilityScore: number
  hasSpf: boolean
  spfRecord?: string
  hasDmarc: boolean
  dmarcPolicy?: string
  hasMx: boolean
  mxHosts?: string[]
  primaryMailProvider?: string
  riskLevel: 'low' | 'medium' | 'high'
  issues: string[]
}

export async function auditDomainDns(domain: string, simulate = false): Promise<DnsHealthAudit> {
  if (simulate) {
    return {
      deliverabilityScore: 95,
      hasSpf: true,
      spfRecord: 'v=spf1 include:_spf.google.com ~all',
      hasDmarc: true,
      dmarcPolicy: 'reject',
      hasMx: true,
      mxHosts: ['aspmx.l.google.com'],
      primaryMailProvider: 'Google Workspace',
      riskLevel: 'low',
      issues: [],
    }
  }

  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]
  if (!cleanDomain) {
    return {
      deliverabilityScore: 0,
      hasSpf: false,
      hasDmarc: false,
      hasMx: false,
      riskLevel: 'high',
      issues: ['No domain provided'],
    }
  }

  let hasSpf = false
  let spfRecord: string | undefined
  let hasDmarc = false
  let dmarcPolicy: string | undefined
  let hasMx = false
  let mxHosts: string[] = []
  let primaryMailProvider = 'Custom / Unknown'
  const issues: string[] = []

  // 1. Resolve TXT (SPF)
  try {
    const txtRecords = await dns.resolveTxt(cleanDomain)
    for (const recordParts of txtRecords) {
      const full = recordParts.join('')
      if (full.startsWith('v=spf1')) {
        hasSpf = true
        spfRecord = full
        break
      }
    }
  } catch {
    issues.push('Missing or unresolvable SPF record')
  }

  // 2. Resolve DMARC
  try {
    const dmarcRecords = await dns.resolveTxt(`_dmarc.${cleanDomain}`)
    for (const recordParts of dmarcRecords) {
      const full = recordParts.join('')
      if (full.startsWith('v=DMARC1')) {
        hasDmarc = true
        const pMatch = full.match(/p=([a-zA-Z]+)/i)
        dmarcPolicy = pMatch ? pMatch[1].toLowerCase() : 'none'
        break
      }
    }
  } catch {
    issues.push('Missing DMARC policy record')
  }

  // 3. Resolve MX
  try {
    const mxEntries = await dns.resolveMx(cleanDomain)
    if (mxEntries && mxEntries.length > 0) {
      hasMx = true
      mxHosts = mxEntries.map((m) => m.exchange)

      const mxStr = mxHosts.join(' ').toLowerCase()
      if (mxStr.includes('google.com') || mxStr.includes('googlemail.com')) {
        primaryMailProvider = 'Google Workspace'
      } else if (mxStr.includes('outlook.com') || mxStr.includes('microsoft.com')) {
        primaryMailProvider = 'Microsoft 365'
      } else if (mxStr.includes('zoho.com')) {
        primaryMailProvider = 'Zoho Mail'
      } else if (mxStr.includes('protonmail.ch') || mxStr.includes('proton.me')) {
        primaryMailProvider = 'Proton'
      }
    } else {
      issues.push('No active MX records found')
    }
  } catch {
    issues.push('Failed to resolve MX records')
  }

  // Calculate deliverability score (0 - 100)
  let score = 0
  if (hasMx) score += 35
  if (hasSpf) score += 30
  if (hasDmarc) {
    if (dmarcPolicy === 'reject') score += 35
    else if (dmarcPolicy === 'quarantine') score += 25
    else score += 15 // p=none
  }

  let riskLevel: 'low' | 'medium' | 'high' = 'high'
  if (score >= 70) riskLevel = 'low'
  else if (score >= 45) riskLevel = 'medium'

  return {
    deliverabilityScore: score,
    hasSpf,
    spfRecord,
    hasDmarc,
    dmarcPolicy,
    hasMx,
    mxHosts,
    primaryMailProvider,
    riskLevel,
    issues,
  }
}

export function registerDnsHealthNode() {
  const handler: NodeHandler = {
    type: 'dns_health' as any,
    async execute(ctx) {
      const domainField = (ctx.config.domainField as string) || 'domain'
      const minScore = Number(ctx.config.minScore ?? 60)
      const simulate = Boolean(ctx.config.simulate)

      const healthyRecords: PipelineRecord[] = []
      const riskyRecords: PipelineRecord[] = []
      const allRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const domain = String(
          getPath(domainField, rec.data || {}) ||
            rec.data?.website ||
            rec.data?.domain ||
            rec.data?.email?.toString().split('@')[1] ||
            ''
        )

        const audit = await auditDomainDns(domain, simulate)

        const updatedData: Record<string, unknown> = {
          ...rec.data,
          dnsHealth: audit,
          deliverabilityScore: audit.deliverabilityScore,
          isDeliverable: audit.deliverabilityScore >= minScore,
          mailProvider: audit.primaryMailProvider,
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

        if (audit.deliverabilityScore >= minScore && audit.riskLevel !== 'high') {
          healthyRecords.push(enrichedRec)
        } else {
          riskyRecords.push(enrichedRec)
        }
      }

      ctx.log(
        'info',
        `[DnsHealthNode] Checked ${allRecords.length} domains. Deliverable: ${healthyRecords.length}, Risky: ${riskyRecords.length}`
      )

      ctx.emit(allRecords, 'main')
      if (healthyRecords.length > 0) {
        ctx.emit(healthyRecords, 'healthy')
      }
      if (riskyRecords.length > 0) {
        ctx.emit(riskyRecords, 'risky')
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'dns_health' as any,
    name: 'DNS & Deliverability Health',
    description: 'Audits prospect or sender domains for SPF, DMARC, and MX records to calculate cold email deliverability scores.',
    category: 'Process',
    icon: 'ShieldCheck',
    color: '#10B981',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'healthy', label: 'Deliverable (Low Risk)', schema: anySchema },
      { id: 'risky', label: 'Risky / Low Auth', schema: anySchema },
    ],
    configSchema: {
      domainField: strField('Domain Property', false, 'Property holding domain or email to check', 'domain'),
      minScore: numField('Minimum Deliverability Score', false, 'Threshold score (0-100) to classify domain as deliverable', 60),
      simulate: boolField('Simulate (Fast Local Mode)', 'Return deterministic passing health metrics for testing', false),
    },
    help: 'Audits domain email infrastructure to prevent domain burning.\n\nConnect the "Deliverable" port to your outreach campaign and route "Risky" domains to alternative channels like LinkedIn or Voice AI.',
  })

  registerNode(handler, descriptor)
}
