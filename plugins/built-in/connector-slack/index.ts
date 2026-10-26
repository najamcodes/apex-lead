import { z } from 'zod'
import type { ConnectorPlugin, PluginEvent } from '../../types'

const ConfigSchema = z.object({
  webhook_url: z.string().url(),
  channel_name: z.string().optional().default('#leads'),
})

const slackPlugin: ConnectorPlugin = {
  kind: 'connector',
  id: 'connector-slack',
  name: 'Slack Alerts & Notifications',
  version: '1.0.0',
  description: 'Broadcasts new high-intent replies, approved leads, and status updates directly to a Slack channel.',
  author: 'LeadHunter',
  configSchema: ConfigSchema,
  on: ['outreach.replied', 'lead.approved'],

  async push(event: PluginEvent, config: Record<string, unknown>): Promise<void> {
    const { sendSlackAlert } = await import('./slack')
    const pluginCfg = ConfigSchema.parse(config)
    await sendSlackAlert(pluginCfg.webhook_url, event, pluginCfg.channel_name)
  },
}

export default slackPlugin
