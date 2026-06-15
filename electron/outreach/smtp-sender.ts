import nodemailer from 'nodemailer'
import type { SendResult } from '../../src/types/outreach.types'
import type { EmailAccount } from '../../src/types'

const _transporters = new Map<string, nodemailer.Transporter>()
export function getTransporter(account: EmailAccount): nodemailer.Transporter {
  if (_transporters.has(account.email_address)) {
    return _transporters.get(account.email_address)!
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: account.email_address,
      pass: account.app_password
    }
  })

  _transporters.set(account.email_address, transporter)
  return transporter
}

export async function verifySmtp(account: EmailAccount): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = getTransporter(account)
    await transporter.verify()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function sendEmail(
  account: EmailAccount,
  to: string,
  subject: string,
  bodyText: string
): Promise<SendResult> {
  try {
    const transporter = getTransporter(account)
    const info = await transporter.sendMail({
      from: `"${account.sender_name}" <${account.email_address}>`,
      to,
      subject,
      text: bodyText
    })
    return { success: true, message_id: info.messageId ?? null, error: null }
  } catch (err) {
    return { success: false, message_id: null, error: String(err) }
  }
}
