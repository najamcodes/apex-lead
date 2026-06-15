import fetch from 'node-fetch'
import { getSettings } from '../../src/db/queries/settings.queries'
import { getLeadById } from '../../src/db/queries/leads.queries'

export async function sendDiscordAlert(leadId: number, intent: string, summary: string) {
  try {
    const settings = await getSettings()
    if (!settings.discord_webhook_url) {
      return
    }

    const lead = await getLeadById(leadId)
    if (!lead) return

    let color = 3447003 // Blue
    if (intent === 'interested') color = 3066993 // Green
    if (intent === 'objection') color = 15105570 // Orange
    if (intent === 'not_interested') color = 15158332 // Red

    const embed = {
      title: `📩 Reply Received: ${lead.business_name}`,
      description: `**Intent:** \`${intent.toUpperCase()}\`\n\n**AI Summary:**\n${summary}`,
      color,
      fields: [
        {
          name: 'Contact Name',
          value: lead.contact_name || 'Unknown',
          inline: true
        },
        {
          name: 'Email',
          value: lead.email || 'Unknown',
          inline: true
        },
        {
          name: 'Lead Status',
          value: lead.status,
          inline: true
        }
      ],
      footer: {
        text: 'LeadHunter Autonomous Pipeline'
      },
      timestamp: new Date().toISOString()
    }

    await fetch(settings.discord_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    })

    console.log(`[Discord] Alert sent for lead ${leadId} (${intent})`)
  } catch (error) {
    console.error(`[Discord] Failed to send alert:`, error)
  }
}
