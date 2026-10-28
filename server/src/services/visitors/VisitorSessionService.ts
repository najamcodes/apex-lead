import { DataSource } from 'typeorm'
import { VisitorSiteEntity } from '../../db/entities/VisitorSiteEntity'
import { VisitorSessionEntity } from '../../db/entities/VisitorSessionEntity'
import { VisitorPageviewEntity } from '../../db/entities/VisitorPageviewEntity'
import { ReverseIpResolver } from './ReverseIpResolver'
import { SlackAlertNotifier } from './SlackAlertNotifier'

export interface TrackPayload {
  siteKey: string
  sessionId: string
  ip: string
  path: string
  referrer?: string
  durationSeconds?: number
}

export class VisitorSessionService {
  constructor(
    private dataSource: DataSource,
    private slackNotifier: SlackAlertNotifier
  ) {}

  public async trackEvent(payload: TrackPayload): Promise<{ session: VisitorSessionEntity | null }> {
    const siteRepo = this.dataSource.getRepository(VisitorSiteEntity)
    const sessionRepo = this.dataSource.getRepository(VisitorSessionEntity)
    const pageviewRepo = this.dataSource.getRepository(VisitorPageviewEntity)

    // 1. Verify Site Key
    const site = await siteRepo.findOne({ where: { api_key: payload.siteKey } })
    if (!site) {
      return { session: null }
    }

    // 2. Find or create session
    let session = await sessionRepo.findOne({
      where: { site_id: site.id, ip_address: payload.ip },
    })

    if (!session) {
      const company = await ReverseIpResolver.resolveIp(payload.ip)
      session = sessionRepo.create({
        site_id: site.id,
        ip_address: payload.ip,
        company_name: company.companyName || undefined,
        company_domain: company.companyDomain || undefined,
        company_industry: company.industry || undefined,
        intent_score: 10,
        pageview_count: 1,
        visited_pricing: payload.path.includes('/pricing'),
      })
    } else {
      session.pageview_count += 1
      if (payload.path.includes('/pricing')) {
        session.visited_pricing = true
      }
    }

    // 3. Compute Intent Score
    let score = 10 + (session.pageview_count - 1) * 5
    if (session.visited_pricing) score += 25
    if ((payload.durationSeconds || 0) > 60) score += 10
    session.intent_score = Math.min(100, score)
    session.last_active_at = new Date()

    await sessionRepo.save(session)

    // 4. Record Pageview
    const pageview = pageviewRepo.create({
      session_id: session.id,
      path: payload.path,
      referrer: payload.referrer,
      duration_seconds: payload.durationSeconds || 0,
    })
    await pageviewRepo.save(pageview)

    // 5. Fire high-intent alert if intent score passes 35 and has webhook
    if (session.intent_score >= 35 && site.slack_webhook_url && session.company_name) {
      await this.slackNotifier.notifyHighIntentVisitor(site.slack_webhook_url, {
        companyName: session.company_name,
        companyDomain: session.company_domain || 'unknown',
        intentScore: session.intent_score,
        pageviewCount: session.pageview_count,
        visitedPricing: session.visited_pricing,
        lastPagePath: payload.path,
      })
    }

    return { session }
  }
}
