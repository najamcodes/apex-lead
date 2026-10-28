import type { RequestContext } from 'katal';
import { getDataSource } from '../../db';
import { getTenantId } from '../../db/queries/tenant';
import { LeadEntity } from '../../db/entities/LeadEntity';
import { OutreachEntity } from '../../db/entities/OutreachEntity';
import { PipelineRunEntity } from '../../db/entities/PipelineRunEntity';
import { sendError, HttpStatus } from '../../common';

export interface FunnelStep {
  name: string;
  key: string;
  count: number;
  percentage: number;
  dropoffRate: number;
  color: string;
}

export class AnalyticsController {
  /**
   * GET /api/analytics/roi - Aggregated conversion funnel and performance intelligence
   */
  static async getRoiAnalytics(c: RequestContext): Promise<Response> {
    try {
      const orgId = getTenantId();
      const ds = getDataSource();

      const leadRepo = ds.getRepository(LeadEntity);
      const outreachRepo = ds.getRepository(OutreachEntity);
      const runRepo = ds.getRepository(PipelineRunEntity);

      // 1. Funnel counts
      const totalLeads = await leadRepo.count({ where: { org_id: orgId } });

      const withWebsite = await leadRepo
        .createQueryBuilder('l')
        .where('l.org_id = :orgId', { orgId })
        .andWhere('l.website_url IS NOT NULL AND l.website_url != ""')
        .getCount();

      const qualifiedLeads = await leadRepo
        .createQueryBuilder('l')
        .where('l.org_id = :orgId', { orgId })
        .andWhere('l.ai_site_score >= 50 OR l.priority_score >= 50 OR l.status IN ("approved", "contacted", "converted")')
        .getCount();

      const withEmail = await leadRepo
        .createQueryBuilder('l')
        .where('l.org_id = :orgId', { orgId })
        .andWhere('l.email IS NOT NULL AND l.email != ""')
        .getCount();

      const outreachSent = await outreachRepo
        .createQueryBuilder('o')
        .where('o.org_id = :orgId', { orgId })
        .andWhere('o.sent_at IS NOT NULL OR o.status = "sent"')
        .getCount();

      const outreachOpened = await outreachRepo
        .createQueryBuilder('o')
        .where('o.org_id = :orgId', { orgId })
        .andWhere('o.opened_at IS NOT NULL OR o.status = "opened"')
        .getCount();

      const outreachReplied = await outreachRepo
        .createQueryBuilder('o')
        .where('o.org_id = :orgId', { orgId })
        .andWhere('o.replied_at IS NOT NULL OR o.status = "replied"')
        .getCount();

      // 2. Build Funnel steps
      const base = Math.max(1, totalLeads);
      const steps: FunnelStep[] = [
        {
          name: 'Total Scraped',
          key: 'scraped',
          count: totalLeads,
          percentage: 100,
          dropoffRate: 0,
          color: '#3b82f6',
        },
        {
          name: 'Has Website',
          key: 'has_website',
          count: withWebsite,
          percentage: Math.round((withWebsite / base) * 100),
          dropoffRate: Math.max(0, Math.round(((totalLeads - withWebsite) / base) * 100)),
          color: '#06b6d4',
        },
        {
          name: 'AI Qualified',
          key: 'qualified',
          count: qualifiedLeads,
          percentage: Math.round((qualifiedLeads / base) * 100),
          dropoffRate: Math.max(0, Math.round(((withWebsite - qualifiedLeads) / Math.max(1, withWebsite)) * 100)),
          color: '#8b5cf6',
        },
        {
          name: 'Email Found',
          key: 'email_found',
          count: withEmail,
          percentage: Math.round((withEmail / base) * 100),
          dropoffRate: Math.max(0, Math.round(((qualifiedLeads - withEmail) / Math.max(1, qualifiedLeads)) * 100)),
          color: '#10b981',
        },
        {
          name: 'Outreach Sent',
          key: 'sent',
          count: outreachSent,
          percentage: Math.round((outreachSent / base) * 100),
          dropoffRate: 0,
          color: '#f59e0b',
        },
        {
          name: 'Emails Opened',
          key: 'opened',
          count: outreachOpened,
          percentage: Math.round((outreachOpened / Math.max(1, outreachSent)) * 100),
          dropoffRate: Math.max(0, Math.round(((outreachSent - outreachOpened) / Math.max(1, outreachSent)) * 100)),
          color: '#ec4899',
        },
        {
          name: 'Replies / Won',
          key: 'replied',
          count: outreachReplied,
          percentage: Math.round((outreachReplied / Math.max(1, outreachSent)) * 100),
          dropoffRate: Math.max(0, Math.round(((outreachOpened - outreachReplied) / Math.max(1, Math.max(1, outreachOpened))) * 100)),
          color: '#22c55e',
        },
      ];

      // 3. Top categories breakdown
      const categoryRows = await leadRepo
        .createQueryBuilder('l')
        .select('COALESCE(NULLIF(l.category, ""), "Uncategorized")', 'category')
        .addSelect('COUNT(*)', 'total')
        .addSelect('SUM(CASE WHEN l.ai_site_score >= 50 OR l.priority_score >= 50 THEN 1 ELSE 0 END)', 'qualified')
        .addSelect('SUM(CASE WHEN l.email IS NOT NULL AND l.email != "" THEN 1 ELSE 0 END)', 'email_found')
        .where('l.org_id = :orgId', { orgId })
        .groupBy('l.category')
        .orderBy('total', 'DESC')
        .limit(6)
        .getRawMany<{ category: string; total: string | number; qualified: string | number; email_found: string | number }>();

      const topCategories = categoryRows.map((r) => ({
        category: r.category,
        total: Number(r.total || 0),
        qualified: Number(r.qualified || 0),
        emailFound: Number(r.email_found || 0),
      }));

      // 4. Top cities breakdown
      const cityRows = await leadRepo
        .createQueryBuilder('l')
        .select('COALESCE(NULLIF(l.city, ""), "Unknown")', 'city')
        .addSelect('COUNT(*)', 'total')
        .addSelect('SUM(CASE WHEN l.ai_site_score >= 50 OR l.priority_score >= 50 THEN 1 ELSE 0 END)', 'qualified')
        .addSelect('SUM(CASE WHEN l.email IS NOT NULL AND l.email != "" THEN 1 ELSE 0 END)', 'email_found')
        .where('l.org_id = :orgId', { orgId })
        .groupBy('l.city')
        .orderBy('total', 'DESC')
        .limit(6)
        .getRawMany<{ city: string; total: string | number; qualified: string | number; email_found: string | number }>();

      const topCities = cityRows.map((r) => ({
        city: r.city,
        total: Number(r.total || 0),
        qualified: Number(r.qualified || 0),
        emailFound: Number(r.email_found || 0),
      }));

      // 5. Source distribution
      const sourceRows = await leadRepo
        .createQueryBuilder('l')
        .select('COALESCE(NULLIF(l.source, ""), "direct")', 'source')
        .addSelect('COUNT(*)', 'total')
        .where('l.org_id = :orgId', { orgId })
        .groupBy('l.source')
        .orderBy('total', 'DESC')
        .getRawMany<{ source: string; total: string | number }>();

      const sources = sourceRows.map((r) => ({
        source: r.source,
        total: Number(r.total || 0),
        percentage: Math.round((Number(r.total || 0) / base) * 100),
      }));

      // 6. Pipeline execution health
      const totalRuns = await runRepo.count({ where: { org_id: orgId } });
      const successfulRuns = await runRepo.count({ where: { org_id: orgId, status: 'completed' } });
      const pipelineSuccessRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 100;

      return c.json({
        funnel: steps,
        metrics: {
          totalLeads,
          qualifiedRate: Math.round((qualifiedLeads / base) * 100),
          emailDiscoveryRate: Math.round((withEmail / base) * 100),
          outreachSent,
          openRate: outreachSent > 0 ? Math.round((outreachOpened / outreachSent) * 100) : 0,
          replyRate: outreachSent > 0 ? Math.round((outreachReplied / outreachSent) * 100) : 0,
          pipelineRunsTotal: totalRuns,
          pipelineSuccessRate,
        },
        topCategories,
        topCities,
        sources,
      });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
