export interface HighIntentAlert {
  companyName: string
  companyDomain: string
  intentScore: number
  pageviewCount: number
  visitedPricing: boolean
  lastPagePath: string
}

export class SlackAlertNotifier {
  public async notifyHighIntentVisitor(
    webhookUrl: string,
    alert: HighIntentAlert
  ): Promise<boolean> {
    if (!webhookUrl) return false

    const pricingBadge = alert.visitedPricing ? '🔥 *Visited /pricing*' : '👀 Active Browsing'
    const payload = {
      text: `🚨 High-Intent Visitor Alert: *${alert.companyName}* (${alert.companyDomain})`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🎯 High-Intent Account Detected: ${alert.companyName}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Company Domain:*\n<https://${alert.companyDomain}|${alert.companyDomain}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Intent Score:*\n\`${alert.intentScore}/100\` (${pricingBadge})`,
            },
            {
              type: 'mrkdwn',
              text: `*Total Pageviews:*\n${alert.pageviewCount} pages`,
            },
            {
              type: 'mrkdwn',
              text: `*Active URL:*\n\`${alert.lastPagePath}\``,
            },
          ],
        },
      ],
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return res.ok
    } catch {
      return false
    }
  }
}
