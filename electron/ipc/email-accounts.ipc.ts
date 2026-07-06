import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import {
  getEmailAccounts,
  addEmailAccount,
  updateEmailAccount,
  deleteEmailAccount,
  getRawEmailAccountById
} from '../../backend/db/queries/email-accounts.queries'
import { getCurrentUserRole, getCurrentUserPermissions } from '../../backend/db/queries/tenant'

function requirePermission(perm: string) {
  if (getCurrentUserRole() === 'admin') return;
  const perms = getCurrentUserPermissions();
  if (!perms.includes(perm)) {
    throw new Error(`Unauthorized: Missing permission ${perm}`);
  }
}
import nodemailer from 'nodemailer'

export function registerEmailAccountsIpc(): void {
  ipcMain.handle(IPC.EMAIL_ACCOUNTS_GET_ALL, async () => {
    return await getEmailAccounts()
  })

  ipcMain.handle(IPC.EMAIL_ACCOUNTS_ADD, async (_event, data) => {
    requirePermission('manage_settings')
    return await addEmailAccount(data)
  })

  ipcMain.handle(IPC.EMAIL_ACCOUNTS_UPDATE, async (_event, id: number, data) => {
    requirePermission('manage_settings')
    await updateEmailAccount(id, data)
  })

  ipcMain.handle(IPC.EMAIL_ACCOUNTS_DELETE, async (_event, id: number) => {
    requirePermission('manage_settings')
    await deleteEmailAccount(id)
  })

  ipcMain.handle(IPC.EMAIL_ACCOUNTS_TEST, async (_event, id: number) => {
    requirePermission('manage_settings')
    const account = await getRawEmailAccountById(id)
    if (!account) return { ok: false, error: 'Account not found' }

    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: account.email_address,
          pass: account.app_password
        }
      })
      await transporter.verify()
      await updateEmailAccount(id, { status: 'active', last_error: null } as any)
      return { ok: true }
    } catch (err: any) {
      await updateEmailAccount(id, { status: 'error', last_error: err.message } as any)
      return { ok: false, error: err.message }
    }
  })
}
