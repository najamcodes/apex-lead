import { getDataSource } from '../../db'
import { logActivity } from '../../db/queries/activity.queries'
import { getSettings } from '../../db/queries/settings.queries'
import { scoreSite } from '../ai/tasks/score-site'
import { calculatePriority } from './priority-calculator'
import { LeadEntity } from '../../db/entities/LeadEntity'
import { runEnrichers, makeLeadSnapshot } from '../../../plugins/runner'
import { connectorHook } from '../outreach/connector-hook'
import type { AnalysisResult } from '../../../shared/types/analysis.types'

export async function analyzeLead(leadId: number): Promise<AnalysisResult> {
  const leadRepo = getDataSource().getRepository(LeadEntity)
  const lead = await leadRepo.findOneBy({ id: leadId })
  if (!lead) throw new Error(`Lead ${leadId} not found`)

  const settings = await getSettings()

  // 1. Dispatch all decentralized plugins (enrichers)
  const snapshot = makeLeadSnapshot(lead as unknown as Record<string, unknown>)
  let pluginFields: any = {}
  try {
    pluginFields = await runEnrichers(snapshot)
  } catch (err) {
    console.error('[analysis] Plugin enricher dispatch failed:', err)
  }

  // 2. Update the DB with plugin results
  if (Object.keys(pluginFields).length > 0) {
    await leadRepo.update(leadId, { ...pluginFields, updated_at: new Date().toISOString() })
  }

  // 3. Re-fetch the fresh lead for priority calculation and AI scoring
  const freshLead = await leadRepo.findOneBy({ id: leadId })
  if (!freshLead) throw new Error('Lead not found after analysis')

  const priorityResult = calculatePriority({
    website_url:       freshLead.website_url,
    pagespeed_mobile:  freshLead.pagespeed_mobile,
    pagespeed_desktop: freshLead.pagespeed_desktop,
    ssl_valid:         freshLead.ssl_valid,
    tech_stack:        freshLead.tech_stack,
    site_built_year:   freshLead.site_built_year,
    phone:             freshLead.phone,
    rating:            freshLead.review_rating,
    review_count:      freshLead.review_count,
  })

  await leadRepo.update(leadId, {
    priority_score: priorityResult.priority_score,
    priority_breakdown: JSON.stringify({ breakdown: priorityResult.breakdown, reasons: priorityResult.reasons }),
    updated_at: new Date().toISOString()
  })

  // 4. Run AI scoring now that we have all plugin data
  if (settings.ai_enabled) {
    try {
      // Create a mock ssl object for the prompt if needed, or update prompt to use freshLead
      const mockSsl = { ssl_valid: freshLead.ssl_valid }
      await scoreSite(settings, leadId, settings.ai_model_site_scoring, mockSsl as any)
    } catch {
      // AI failure shouldn't block analysis
    }
  }

  // 5. Auto-advance status: scraped → qualified if we have enough data
  const finalLead = await leadRepo.findOneBy({ id: leadId })
  if (finalLead?.status === 'scraped') {
    await leadRepo.update(leadId, {
      status: 'qualified',
      updated_at: new Date().toISOString()
    })
    // Fire connector plugins
    connectorHook.leadQualified(leadId).catch(() => {})
  }

  await logActivity(
    leadId,
    'lead_analyzed',
    `Priority: ${priorityResult.priority_score}/100 — ${priorityResult.reasons.join(', ')}`
  )

  return {
    lead_id: leadId,
    pagespeed: null,
    wappalyzer: null,
    ssl: null,
    error: null
  }
}

export async function analyzeBatch(
  leadIds: number[],
  onProgress: (done: number, total: number, leadId: number) => void
): Promise<void> {
  for (let i = 0; i < leadIds.length; i++) {
    try {
      await analyzeLead(leadIds[i])
    } catch { }
    onProgress(i + 1, leadIds.length, leadIds[i])
    await new Promise((r) => setTimeout(r, 1200))
  }
}
