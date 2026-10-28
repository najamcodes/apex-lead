export interface MetricItemDto {
  label: string;
  value: number;
  changePercent?: number;
  trend?: 'up' | 'down' | 'neutral';
}

export interface DashboardStatsDto {
  totalLeads: number;
  enrichedLeads: number;
  verifiedEmails: number;
  emailsSent: number;
  replyRate: number;
  conversionRate: number;
  activeWorkflows: number;
  metrics?: MetricItemDto[];
  timestamp: string;
}

export class AnalyticsResponseAdapter {
  static toStatsDto(raw: {
    totalLeads?: number;
    enrichedLeads?: number;
    verifiedEmails?: number;
    emailsSent?: number;
    replyRate?: number;
    conversionRate?: number;
    activeWorkflows?: number;
    metrics?: MetricItemDto[];
  }): DashboardStatsDto {
    return {
      totalLeads: raw.totalLeads ?? 0,
      enrichedLeads: raw.enrichedLeads ?? 0,
      verifiedEmails: raw.verifiedEmails ?? 0,
      emailsSent: raw.emailsSent ?? 0,
      replyRate: Number((raw.replyRate ?? 0).toFixed(2)),
      conversionRate: Number((raw.conversionRate ?? 0).toFixed(2)),
      activeWorkflows: raw.activeWorkflows ?? 0,
      metrics: raw.metrics,
      timestamp: new Date().toISOString(),
    };
  }
}
