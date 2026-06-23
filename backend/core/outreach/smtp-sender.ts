import nodemailer from 'nodemailer'
import { getRawEmailAccountById } from '../../db/queries/email-accounts.queries'
import type { SendResult } from '../../../shared/types/outreach.types'
import type { EmailAccount } from '../../../shared/types'

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
  const rawAccount = await getRawEmailAccountById(account.id)
  if (!rawAccount) return { ok: false, error: 'Account not found' }
  try {
    const transporter = getTransporter(rawAccount)
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
  const rawAccount = await getRawEmailAccountById(account.id)
  if (!rawAccount) throw new Error(`Email account ${account.id} not found`)
  try {
    const transporter = getTransporter(rawAccount)
    const info = await transporter.sendMail({
      from: `"${rawAccount.sender_name}" <${rawAccount.email_address}>`,
      to,
      subject,
      text: bodyText,
      html: bodyText
    })
    return { success: true, message_id: info.messageId ?? null, error: null }
  } catch (err) {
    return { success: false, message_id: null, error: String(err) }
  }
}
