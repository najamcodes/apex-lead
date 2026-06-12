// electron/outreach/smtp-sender.ts
import nodemailer from 'nodemailer'
import type { SmtpConfig, SendResult } from '../../src/types/outreach.types'

let _transporter: nodemailer.Transporter | null = null
let _config: SmtpConfig | null = null

export function configureSmtp(config: SmtpConfig): void {
  _config = config
  _transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password
    },
    tls: { rejectUnauthorized: false } // allow self-signed certs
  })
}

export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  if (!_transporter) return { ok: false, error: 'SMTP not configured' }
  try {
    await _transporter.verify()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  bodyText: string
): Promise<SendResult> {
  if (!_transporter || !_config) {
    return { success: false, message_id: null, error: 'SMTP not configured. Add SMTP settings.' }
  }

  try {
    const info = await _transporter.sendMail({
      from: `"${_config.from_name}" <${_config.from_email}>`,
      to,
      subject,
      text: bodyText
      // Plain text only — avoids spam filters better than HTML for cold outreach
    })
    return { success: true, message_id: info.messageId ?? null, error: null }
  } catch (err) {
    return { success: false, message_id: null, error: String(err) }
  }
}
