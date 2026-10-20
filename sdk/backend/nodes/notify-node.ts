// backend/nodes/notify-node.ts
// Fire-and-forget notification: email (SMTP), Discord webhook, Slack webhook, or generic HTTP POST.

import { registerNode } from '../engine/registry'
import { makeDescriptor, selectField, strField, textField, mainOutput, mainInput, getPath } from './descriptors'
import type { NodeHandler } from '../engine/types'

export function registerNotifyNode() {
  const handler: NodeHandler = {
    type: 'notify',
    async execute(ctx) {
      const channel = (ctx.config.channel as string) || 'webhook'

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        const interpolated = (template: string): string =>
          template.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
            const path = expr.trim().replace(/^(record|input)\./, '')
            const val = getPath(path, { ...ctx.input, ...rec.data })
            return val !== undefined && val !== null ? String(val) : ''
          })

        try {
          switch (channel) {
            case 'discord':
            case 'slack':
            case 'webhook': {
              let url = ctx.config.url as string | undefined
              if (!url || url.trim() === '') {
                const { getSettings } = await import('../db/queries/settings.queries')
                const settings = await getSettings()
                if (channel === 'discord') url = settings.discord_webhook_url
              }

              if (!url) {
                ctx.log('error', `Notify (${channel}): No webhook URL configured on node or in settings`)
                continue
              }

              const rawBody = ctx.config.body as string | undefined
              let body: string
              if (channel === 'discord') {
                body = JSON.stringify({ content: interpolated(rawBody || '{{record}}') })
              } else if (channel === 'slack') {
                body = JSON.stringify({ text: interpolated(rawBody || '{{record}}') })
              } else {
                body = rawBody ? interpolated(rawBody) : JSON.stringify(rec.data)
              }
              const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: AbortSignal.timeout(10_000),
              })
              ctx.log('info', `Notify (${channel}): HTTP ${res.status}`)
              break
            }

            case 'email': {
              const { getSettings } = await import('../db/queries/settings.queries')
              const settings = await getSettings()
              if (!settings.smtp_host) { ctx.log('error', 'Notify (email): SMTP not configured'); continue }
              const nodemailer = await import('nodemailer')
              const transporter = nodemailer.createTransport({
                host: settings.smtp_host,
                port: settings.smtp_port || 587,
                secure: settings.smtp_secure || false,
                auth: settings.smtp_username
                  ? { user: settings.smtp_username, pass: settings.smtp_password }
                  : undefined,
              })
              await transporter.sendMail({
                from: settings.smtp_from_email || settings.smtp_username || 'noreply@leadhunter',
                to: interpolated(ctx.config.to as string || ''),
                subject: interpolated(ctx.config.subject as string || 'Notification'),
                text: interpolated(ctx.config.body as string || JSON.stringify(rec.data, null, 2)),
              })
              ctx.log('info', `Notify (email): sent to ${ctx.config.to}`)
              break
            }

            default:
              ctx.log('warn', `Notify: unknown channel '${channel}'`)
          }
          ctx.emit(rec)
        } catch (err) {
          ctx.log('error', `Notify failed: ${err instanceof Error ? err.message : String(err)}`)
          ctx.emit(rec) // pass through even on failure so pipeline continues
        }
      }
    },
  }

  const descriptor = makeDescriptor({
    type: 'notify',
    name: 'Notify',
    description: 'Send a fire-and-forget notification via Discord webhook, Slack webhook, generic HTTP webhook, or email.',
    category: 'Notify',
    icon: 'Bell',
    color: '#f97316',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      channel: selectField('Channel', ['discord', 'slack', 'webhook', 'email'], 'Where to send the notification.', 'discord'),
      url: strField('Webhook URL', false, 'Discord/Slack/generic webhook URL. Supports {{record.field}} substitution.'),
      to: strField('Email To', false, 'Recipient email address (email channel only).'),
      subject: strField('Subject', false, 'Email subject. Supports {{record.field}}.', 'Notification'),
      body: textField('Message body', false, 'Message to send. Supports {{record.field}} and {{input.field}} placeholders.', '{{record}}'),
    },
    help: 'Records pass through unchanged — this node only sends a side-effect notification.\n\nFor Discord: paste your Discord channel webhook URL.\nFor Slack: use an Incoming Webhook URL.\nFor email: configure SMTP in Settings first.',
  })

  registerNode(handler, descriptor)
}
