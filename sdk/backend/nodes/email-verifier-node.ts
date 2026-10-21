// sdk/backend/nodes/email-verifier-node.ts
// Pipeline node for pre-flight email hygiene, syntax verification, disposable domain detection,
// role account identification, and deliverability risk scoring (0-100).

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  strField,
  numField,
  mainOutput,
  mainInput,
  anySchema,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

const RFC_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'trashmail.com',
  'yopmail.com',
  'getnada.com',
  'sharklasers.com',
  'throwawaymail.com',
  'dispostable.com',
  'fakemailgenerator.com',
  'inboxkitten.com',
  'burnermail.io',
])

const FREE_PROVIDERS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'aol.com',
  'icloud.com',
  'mail.com',
  'zoho.com',
  'protonmail.com',
  'proton.me',
])

const ROLE_PREFIXES = new Set([
  'admin',
  'billing',
  'careers',
  'contact',
  'help',
  'hr',
  'info',
  'inquiries',
  'jobs',
  'marketing',
  'media',
  'office',
  'press',
  'sales',
  'security',
  'support',
  'team',
])

export interface EmailVerificationResult {
  email: string
  isValidSyntax: boolean
  isDisposable: boolean
  isRoleAccount: boolean
  isFreeProvider: boolean
  domain: string
  score: number // 0-100
  tier: 'valid' | 'risky' | 'invalid'
  reasons: string[]
}

export function auditEmailDeliverability(email: string): EmailVerificationResult {
  const clean = String(email || '').trim().toLowerCase()
  if (!clean || !clean.includes('@')) {
    return {
      email: clean,
      isValidSyntax: false,
      isDisposable: false,
      isRoleAccount: false,
      isFreeProvider: false,
      domain: '',
      score: 0,
      tier: 'invalid',
      reasons: ['Missing or empty email address'],
    }
  }

  const parts = clean.split('@')
  const user = parts[0]
  const domain = parts[1] || ''

  const isValidSyntax = RFC_EMAIL_REGEX.test(clean) && !user.includes('..') && !domain.startsWith('-')
  const isDisposable = DISPOSABLE_DOMAINS.has(domain)
  const isFreeProvider = FREE_PROVIDERS.has(domain)
  const isRoleAccount = ROLE_PREFIXES.has(user)

  const reasons: string[] = []
  let score = 95

  if (!isValidSyntax) {
    score = 0
    reasons.push('Invalid RFC 5322 syntax or illegal characters')
  }

  if (isDisposable) {
    score = 0
    reasons.push('Disposable or temporary email service')
  }

  if (isRoleAccount) {
    score -= 35
    reasons.push('Generic department or role account (lower open rates)')
  }

  if (isFreeProvider) {
    score -= 20
    reasons.push('Free consumer email provider instead of corporate domain')
  }

  score = Math.max(0, Math.min(100, score))

  let tier: 'valid' | 'risky' | 'invalid' = 'valid'
  if (score < 40 || !isValidSyntax || isDisposable) {
    tier = 'invalid'
  } else if (score <= 75) {
    tier = 'risky'
  }

  return {
    email: clean,
    isValidSyntax,
    isDisposable,
    isRoleAccount,
    isFreeProvider,
    domain,
    score,
    tier,
    reasons,
  }
}

export function registerEmailVerifierNode() {
  const handler: NodeHandler = {
    type: 'email_verifier' as any,
    async execute(ctx) {
      const emailField = (ctx.config.emailField as string) || 'email'
      const minScoreThreshold = Number(ctx.config.minScoreThreshold ?? 70)
      const prefix = ctx.config.fieldPrefix !== undefined ? String(ctx.config.fieldPrefix) : 'verify_'

      const validRecords: PipelineRecord[] = []
      const riskyRecords: PipelineRecord[] = []
      const invalidRecords: PipelineRecord[] = []
      const allRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const recData = (rec && typeof rec.data === 'object' && rec.data !== null) ? rec.data : {}
        const emailStr = String(recData[emailField] || '').trim()

        const result = auditEmailDeliverability(emailStr)

        const enrichedData: Record<string, unknown> = {
          ...recData,
          [`${prefix}email`]: result.email,
          [`${prefix}score`]: result.score,
          [`${prefix}tier`]: result.tier,
          [`${prefix}is_valid`]: result.isValidSyntax && !result.isDisposable,
          [`${prefix}is_disposable`]: result.isDisposable,
          [`${prefix}is_role`]: result.isRoleAccount,
          [`${prefix}is_free`]: result.isFreeProvider,
          [`${prefix}reasons`]: result.reasons,
        }

        const enrichedRec: PipelineRecord = {
          ...rec,
          data: enrichedData,
          meta: {
            ...rec.meta,
            sourceNodeId: ctx.nodeId,
            trace: [...(rec.meta?.trace || []), ctx.nodeId],
          },
        }

        allRecords.push(enrichedRec)

        if (result.score >= minScoreThreshold && result.tier === 'valid') {
          validRecords.push(enrichedRec)
        } else if (result.tier === 'risky') {
          riskyRecords.push(enrichedRec)
        } else {
          invalidRecords.push(enrichedRec)
        }
      }

      ctx.log(
        'info',
        `[EmailVerifier] Audited ${allRecords.length} emails: ${validRecords.length} deliverable, ${riskyRecords.length} risky, ${invalidRecords.length} invalid/disposable`
      )

      ctx.emit(allRecords, 'main')
      if (validRecords.length > 0) ctx.emit(validRecords, 'valid')
      if (riskyRecords.length > 0) ctx.emit(riskyRecords, 'risky')
      if (invalidRecords.length > 0) ctx.emit(invalidRecords, 'invalid')
    },
  }

  const descriptor = makeDescriptor({
    type: 'email_verifier' as any,
    name: 'Email Hygiene & Deliverability Verifier',
    description: 'Pre-flight deliverability hygiene: checks RFC syntax, disposable inboxes, role addresses, and computes a 0-100 deliverability score.',
    category: 'Process',
    icon: 'ShieldCheck',
    color: '#3B82F6',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'valid', label: 'Valid / Deliverable', schema: anySchema },
      { id: 'risky', label: 'Risky / Free / Role', schema: anySchema },
      { id: 'invalid', label: 'Invalid / Disposable', schema: anySchema },
    ],
    configSchema: {
      emailField: strField('Email Property Key', false, 'Field holding email address to inspect', 'email'),
      minScoreThreshold: numField('Minimum Deliverability Score', false, 'Threshold (0-100) to classify as valid', 70),
      fieldPrefix: strField('Field Prefix', false, 'Prefix for generated audit properties', 'verify_'),
    },
  })

  registerNode(handler, descriptor)
}
