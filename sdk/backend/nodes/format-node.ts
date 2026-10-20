// sdk/backend/nodes/format-node.ts
// Cleans, standardizes, and formats dirty lead data (job titles, names, phone numbers, domains).

import { registerNode } from '../engine/registry'
import { makeDescriptor, boolField, mainOutput, mainInput } from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

export function cleanJobTitle(title: string): string {
  if (!title) return ''
  return title
    // Remove parenthetical hiring text e.g. "(Hiring!)", "[We are hiring]"
    .replace(/[\(\[\{][^\)\]\}]*(hiring|looking|open|seeking)[^\)\]\}]*[\)\]\}]/gi, '')
    // Remove emojis
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    // Remove trailing dashes or pipes e.g. " - Hiring Now"
    .replace(/[\s\-\|]+(we['’]re hiring|hiring now|open to work).*$/i, '')
    .trim()
}

export function toTitleCase(name: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return ''
  // Strip everything except numbers and leading plus sign
  const hasPlus = phone.trim().startsWith('+')
  const digits = phone.replace(/\D/g, '')
  return hasPlus ? `+${digits}` : digits
}

export function extractDomainFromUrl(urlOrEmail: string): string {
  if (!urlOrEmail) return ''
  let str = urlOrEmail.trim().toLowerCase()

  // If it's an email address
  if (str.includes('@')) {
    return str.split('@')[1] || ''
  }

  // Strip protocol and path
  str = str.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  return str.split('/')[0].split(':')[0]
}

export function cleanCompanyName(company: string): string {
  if (!company) return ''
  return company
    // Remove legal entity in parentheses e.g. "(publ)", "(plc)"
    .replace(/\s*\((publ|plc)\)/gi, '')
    // Remove stock tickers in parentheses e.g. "Apple Inc (NASDAQ: AAPL)"
    .replace(/\s*\([A-Z]+:\s*[A-Z0-9]+\)/gi, '')
    // Remove legal entity identifiers e.g. "Acme Corp, Inc.", "Stripe, LLC"
    .replace(/[,]?\s*\b(inc\.?|incorporated|llc\.?|l\.l\.c\.?|ltd\.?|limited|corp\.?|corporation|gmbh|co\.?|company|pty\.?\s*ltd\.?|s\.?a\.?|s\.?l\.?)\b.*$/gi, '')
    // Remove emojis and trailing punctuation
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\s,\.\-]+$/, '')
    .trim()
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' }
  // Strip salutations
  const cleaned = fullName
    .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s+/i, '')
    .replace(/,\s*(jr\.|sr\.|ii|iii|iv|phd|md|esq)$/i, '')
    .trim()

  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) {
    return { firstName: toTitleCase(parts[0]), lastName: '' }
  }
  const firstName = toTitleCase(parts[0])
  const lastName = toTitleCase(parts.slice(1).join(' '))
  return { firstName, lastName }
}

export function registerFormatNode() {
  const handler: NodeHandler = {
    type: 'format' as any,
    async execute(ctx) {
      const cleanTitles = ctx.config.cleanJobTitles !== false
      const titleCase = ctx.config.titleCaseNames !== false
      const formatPhones = ctx.config.normalizePhones !== false
      const extractDomains = ctx.config.extractDomains !== false
      const cleanCompanies = ctx.config.cleanCompanyNames !== false
      const splitNames = ctx.config.splitFullNames !== false

      const outputRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const d: Record<string, any> = { ...(rec.data || {}) }

        // 1. Clean Title
        if (cleanTitles) {
          if (typeof d.title === 'string') d.title = cleanJobTitle(d.title)
          if (typeof d.jobTitle === 'string') d.jobTitle = cleanJobTitle(d.jobTitle)
          if (typeof d.position === 'string') d.position = cleanJobTitle(d.position)
        }

        // 2. Title Case Names
        if (titleCase) {
          if (typeof d.name === 'string') d.name = toTitleCase(d.name)
          if (typeof d.fullName === 'string') d.fullName = toTitleCase(d.fullName)
          if (typeof d.firstName === 'string') d.firstName = toTitleCase(d.firstName)
          if (typeof d.lastName === 'string') d.lastName = toTitleCase(d.lastName)
        }

        // 3. Split Full Name if individual components are missing
        if (splitNames) {
          const rawFull = (typeof d.fullName === 'string' && d.fullName) || (typeof d.name === 'string' && d.name) || ''
          if (rawFull && (!d.firstName || !d.lastName)) {
            const split = splitFullName(rawFull)
            if (!d.firstName && split.firstName) d.firstName = split.firstName
            if (!d.lastName && split.lastName) d.lastName = split.lastName
          }
        }

        // 4. Clean Company Names
        if (cleanCompanies) {
          if (typeof d.companyName === 'string') d.companyName = cleanCompanyName(d.companyName)
          if (typeof d.company === 'string') d.company = cleanCompanyName(d.company)
        }

        // 5. Format Phone
        if (formatPhones) {
          if (typeof d.phone === 'string') d.phone = normalizePhoneNumber(d.phone)
          if (typeof d.phoneNumber === 'string') d.phoneNumber = normalizePhoneNumber(d.phoneNumber)
        }

        // 6. Extract Domain
        if (extractDomains) {
          if (!d.domain) {
            if (typeof d.website === 'string' && d.website) {
              d.domain = extractDomainFromUrl(d.website)
            } else if (typeof d.url === 'string' && d.url) {
              d.domain = extractDomainFromUrl(d.url)
            } else if (typeof d.email === 'string' && d.email) {
              d.domain = extractDomainFromUrl(d.email)
            }
          }
        }

        outputRecords.push({
          ...rec,
          data: d,
          meta: {
            ...rec.meta,
            sourceNodeId: ctx.nodeId,
          },
        })
      }

      ctx.log('info', `[FormatNode] Cleaned and standardized ${outputRecords.length} records`)
      ctx.emit(outputRecords)
    },
  }

  const descriptor = makeDescriptor({
    type: 'format' as any,
    name: 'Data Normalizer',
    description: 'Cleans and standardizes lead names, job titles, phone numbers, and web domains.',
    category: 'Transform',
    icon: 'Sparkles',
    color: '#06B6D4',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      cleanJobTitles: boolField('Clean Job Titles', 'Remove hiring tags, emojis, and status notes from titles', true),
      titleCaseNames: boolField('Format Names to Title Case', 'Capitalize first letters of names and lowercase the rest', true),
      splitFullNames: boolField('Split Full Names', 'Split full name into first and last name if missing', true),
      cleanCompanyNames: boolField('Clean Company Names', 'Strip legal entity identifiers like Inc, LLC, Ltd from company names', true),
      normalizePhones: boolField('Normalize Phone Numbers', 'Clean punctuation and standardize to international numbers', true),
      extractDomains: boolField('Extract Root Domains', 'Derive clean domain from website URL or email if missing', true),
    },
  })

  registerNode(handler, descriptor)
}
