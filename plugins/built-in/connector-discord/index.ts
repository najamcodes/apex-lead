import { z } from 'zod'
import type { ConnectorPlugin, PluginEvent } from '../../types'
import { sendDiscordAlert } from './discord'

const ConfigSchema = z.object({
  webhook_url: z.string().url(),
})

const discordPlugin: ConnectorPlugin = {
  kind: 'connector',
  id: 'connector-discord',
  name: 'Discord Notifications',
  version: '1.0.0',
  description: 'Sends notifications to a Discord channel when events occur.',
  author: 'LeadHunter',
  configSchema: ConfigSchema,
  on: ['outreach.replied'],

  async push(event: PluginEvent, config: Record<string, unknown>): Promise<void> {
    const pluginCfg = ConfigSchema.parse(config)
    await sendDiscordAlert(pluginCfg.webhook_url, event)
  },
}

export default discordPlugin
