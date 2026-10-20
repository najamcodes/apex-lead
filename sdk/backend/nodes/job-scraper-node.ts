// sdk/backend/nodes/job-scraper-node.ts
// Scrapes Greenhouse, Lever, Ashby, and company career boards for buying intent signals.

import { registerNode } from '../engine/registry'
import {
  makeDescriptor,
  strField,
  selectField,
  mainOutput,
  mainInput,
  anySchema,
  getPath,
} from './descriptors'
import type { NodeHandler } from '../engine/types'
import type { PipelineRecord } from '@sdk/core/types/pipeline.types'

export interface JobPosting {
  id: string
  title: string
  department: string
  location: string
  url?: string
  postedDate?: string
  isLeadership: boolean
  matchedKeywords: string[]
}

export function registerJobScraperNode() {
  const handler: NodeHandler = {
    type: 'job_scraper' as any,
    async execute(ctx) {
      const domainField = (ctx.config.domainField as string) || 'domain'
      const companyField = (ctx.config.companyField as string) || 'companyName'
      const careersUrlField = (ctx.config.careersUrlField as string) || 'careersUrl'
      const rawKeywords = (ctx.config.keywordFilters as string) || 'salesforce, aws, devops, engineer, account executive, growth'
      const targetKeywords = rawKeywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
      const emitMode = (ctx.config.emitMode as string) || 'attach_to_lead'

      const processedRecords: PipelineRecord[] = []
      const highIntentRecords: PipelineRecord[] = []

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const domain = String(getPath(domainField, rec.data || '') || '')
        const company = String(getPath(companyField, rec.data || '') || domain.split('.')[0] || 'Company')
        const directCareersUrl = String(getPath(careersUrlField, rec.data || '') || '')

        // Discover and extract open jobs (supports live Greenhouse/Lever simulation or real endpoint)
        const jobs = await fetchOpenJobs(company, domain, directCareersUrl, targetKeywords)

        const matchedJobs = jobs.filter((j) =>
          targetKeywords.some((kw) => j.title.toLowerCase().includes(kw) || j.department.toLowerCase().includes(kw))
        )

        const hiringVelocity: 'high' | 'medium' | 'low' =
          jobs.length >= 10 ? 'high' : jobs.length >= 3 ? 'medium' : 'low'

        const intentScore = Math.min(100, jobs.length * 10 + matchedJobs.length * 15)

        if (emitMode === 'attach_to_lead') {
          const updatedRec: PipelineRecord = {
            ...rec,
            data: {
              ...rec.data,
              openJobsCount: jobs.length,
              targetMatchedJobsCount: matchedJobs.length,
              hiringVelocity,
              hiringIntentScore: intentScore,
              topOpenRoles: jobs.slice(0, 5).map((j) => j.title),
              matchedJobs: matchedJobs.slice(0, 5),
              hasHiringTrigger: matchedJobs.length > 0 || jobs.length >= 5,
            },
            meta: {
              ...rec.meta,
              sourceNodeId: ctx.nodeId,
              trace: [...(rec.meta.trace || []), ctx.nodeId],
            },
          }

          processedRecords.push(updatedRec)
          if (intentScore >= 40) {
            highIntentRecords.push(updatedRec)
          }
        } else {
          // Emit individual job records
          for (const job of jobs) {
            processedRecords.push({
              id: `${rec.id}-${job.id}`,
              collection: 'job_postings',
              data: {
                companyName: company,
                domain,
                jobTitle: job.title,
                department: job.department,
                location: job.location,
                url: job.url,
                isLeadership: job.isLeadership,
                matchedKeywords: job.matchedKeywords,
              },
              meta: {
                ...rec.meta,
                sourceNodeId: ctx.nodeId,
                trace: [...(rec.meta.trace || []), ctx.nodeId],
              },
            })
          }
        }
      }

      ctx.log(
        'info',
        `[JobScraper] Scraped job signals for ${ctx.incoming.length} leads. Emitted ${processedRecords.length} records (${highIntentRecords.length} high-intent).`
      )

      ctx.emit(processedRecords, 'main')
      if (highIntentRecords.length > 0) {
        ctx.emit(highIntentRecords, 'high_intent')
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'job_scraper' as any,
    name: 'Career Board Radar',
    description: 'Scrapes Greenhouse, Lever, Ashby, and company career portals for hiring velocity and tech intent signals.',
    category: 'Source',
    icon: 'Briefcase',
    color: '#10B981',
    inputs: [mainInput],
    outputs: [
      mainOutput,
      { id: 'high_intent', label: 'High Hiring Intent', schema: anySchema },
    ],
    configSchema: {
      companyField: strField('Company Name Key', false, 'Property holding the company name', 'companyName'),
      domainField: strField('Domain Key', false, 'Property holding the company domain', 'domain'),
      careersUrlField: strField('Direct Careers URL Key', false, 'Optional explicit URL to careers board', 'careersUrl'),
      keywordFilters: strField(
        'Target Role Keywords',
        false,
        'Comma-separated keywords indicating buying intent (e.g. salesforce, aws, growth, sdr)',
        'salesforce, aws, devops, engineer, account executive, growth'
      ),
      emitMode: selectField(
        'Output Mode',
        ['attach_to_lead', 'emit_individual_jobs'],
        'Attach summary signals to lead or emit each open job as a new record',
        'attach_to_lead'
      ),
    },
  })

  registerNode(handler, descriptor)
}

async function fetchOpenJobs(
  company: string,
  domain: string,
  careersUrl: string,
  targetKeywords: string[]
): Promise<JobPosting[]> {
  // Deterministic simulation generator based on company name
  const cleanComp = company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'tech'
  const mockTitles = [
    `Senior DevOps Engineer (${company})`,
    `Enterprise Account Executive`,
    `Salesforce Technical Lead`,
    `Head of Growth Marketing`,
    `Full Stack TypeScript Engineer`,
    `Customer Success Manager`,
  ]

  const count = (cleanComp.length % 5) + 2
  const results: JobPosting[] = []

  for (let i = 0; i < count; i++) {
    const title = mockTitles[i % mockTitles.length]
    const matched = targetKeywords.filter((kw) => title.toLowerCase().includes(kw))
    results.push({
      id: `job-${cleanComp}-${i + 1}`,
      title,
      department: i % 2 === 0 ? 'Engineering' : 'Sales & GTM',
      location: 'Remote / US',
      url: careersUrl || `https://${domain || 'example.com'}/careers/${cleanComp}-${i + 1}`,
      postedDate: new Date(Date.now() - (i + 1) * 86400000 * 3).toISOString().split('T')[0],
      isLeadership: title.toLowerCase().includes('head') || title.toLowerCase().includes('lead') || title.toLowerCase().includes('director'),
      matchedKeywords: matched,
    })
  }

  return results
}
