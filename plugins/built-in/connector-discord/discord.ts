import fetch from 'node-fetch'
import type { PluginEvent } from '../../types'

export async function sendDiscordAlert(webhookUrl: string, event: PluginEvent) {
  try {
    const lead = event.lead
    const metadata = event.metadata || {}
    const intent = (metadata.intent as string) || 'unknown'
    const summary = (metadata.summary as string) || ''

    let color = 3447003 // Blue
    if (intent === 'interested') color = 3066993 // Green
    if (intent === 'objection') color = 15105570 // Orange
    if (intent === 'not_interested') color = 15158332 // Red

    const embed = {
      title: `📩 Reply Received: ${lead.contact_name || lead.email || 'Lead'}`,
      description: `**Intent:** ${intent.toUpperCase()}\n\n**AI Summary:**\n${summary || 'No summary available'}`,
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
          value: lead.status || 'unknown',
          inline: true
        }
      ],
      footer: {
        text: 'LeadHunter Autonomous Pipeline'
      },
      timestamp: new Date().toISOString()
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    })

    console.log(`[Discord] Alert sent for lead ${lead.email || lead.id || 'unknown'}`)
  } catch (error) {
    console.error('[Discord] Failed to send alert:', error)
  }
}
