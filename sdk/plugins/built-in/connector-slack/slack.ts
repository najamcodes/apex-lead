import type { PluginEvent } from '../../types'

export async function sendSlackAlert(
  webhookUrl: string,
  event: PluginEvent,
  channelName?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!webhookUrl) {
      console.error('[Slack] Missing Slack Webhook URL')
      return { success: false, error: 'Missing Slack Webhook URL' }
    }
    const lead = event?.lead || {}
    const metadata = event?.metadata || {}
    const eventName = event?.trigger || 'lead.event'
    const intent = (metadata.intent as string) || 'unknown'
    const summary = (metadata.summary as string) || ''

    let headerText = '📩 Inbound Lead Alert'
    if (eventName === 'outreach.replied') {
      headerText = intent === 'interested'
        ? '🔥 High-Intent Reply Received!'
        : intent === 'objection'
        ? '⚠️ Objection / Question Received'
        : '📩 Prospect Replied'
    } else if (eventName === 'lead.approved') {
      headerText = '✅ Lead Approved for Outreach'
    }

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: headerText,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Company:*\n${lead.business_name || 'Unknown Business'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Contact:*\n${lead.contact_name || lead.email || 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Category / City:*\n${lead.category || 'N/A'} • ${lead.city || 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n\`${lead.status || 'scraped'}\``,
          },
        ],
      },
    ]

    if (summary) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*AI Summary:*\n>${summary.replace(/\n/g, '\n>')}`,
        },
      })
    }

    if (lead.website_url) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `🌐 *Website:* <${lead.website_url}|${lead.website_url}> | 🚀 *LeadHunter Autonomous Outreach*`,
          },
        ],
      })
    }

    const payload: Record<string, any> = {
      text: `${headerText} - ${lead.business_name || 'Lead'}`,
      blocks,
    }
    if (channelName && channelName.startsWith('#')) {
      payload.channel = channelName
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(`[Slack] Webhook rejected with status ${res.status}: ${errText}`)
      return { success: false, error: `HTTP ${res.status}: ${errText}` }
    }

    console.log(`[Slack] Alert successfully broadcast for lead ${lead.business_name || lead.email || 'unknown'}`)
    return { success: true }
  } catch (error: any) {
    console.error('[Slack] Failed to send webhook alert:', error)
    return { success: false, error: error?.message || String(error) }
  }
}
