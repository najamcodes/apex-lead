import { getTenantId } from './tenant'
import { getDataSource } from '../index'
import { EmailAccountEntity } from '../entities/EmailAccountEntity'
import type { EmailAccount, EmailAccountInsert } from '../../../shared/types'
import { encrypt, decrypt } from '@sdk/core/utils/crypto'

export async function getEmailAccounts(): Promise<EmailAccount[]> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  const accounts = await repo.find({
    where: { org_id: getTenantId() },
    order: { created_at: 'ASC' }
  })
  // Map to hide passwords from frontend
  const safeAccounts = accounts.map(acc => ({
    ...acc,
    app_password: acc.app_password ? '***' : ''
  }))
  return safeAccounts as EmailAccount[]
}

export async function getEmailAccountById(id: number): Promise<EmailAccount | null> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  const account = await repo.findOneBy({ id, org_id: getTenantId() }) as EmailAccount | null
  if (account) {
    account.app_password = account.app_password ? '***' : ''
  }
  return account
}

export async function getRawEmailAccountById(id: number): Promise<EmailAccount | null> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  const account = await repo.findOneBy({ id, org_id: getTenantId() }) as EmailAccount | null
  if (account && account.app_password) {
    account.app_password = decrypt(account.app_password)
  }
  return account
}

export async function addEmailAccount(data: EmailAccountInsert): Promise<EmailAccount> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  const account = repo.create({
    org_id: getTenantId(),
    email_address: data.email_address,
    app_password: encrypt(data.app_password),
    sender_name: data.sender_name,
    daily_limit: data.daily_limit ?? 50
  })
  return await repo.save(account) as EmailAccount
}

export async function updateEmailAccount(id: number, data: Partial<EmailAccountInsert>): Promise<void> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  const updateData = { ...data }
  if (updateData.app_password && updateData.app_password !== '***') {
    updateData.app_password = encrypt(updateData.app_password)
  } else {
    delete updateData.app_password
  }
  await repo.update({ id, org_id: getTenantId() }, updateData)
}

export async function deleteEmailAccount(id: number): Promise<void> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  await repo.delete({ id, org_id: getTenantId() })
}

export async function incrementSentToday(id: number): Promise<void> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  await repo.increment({ id, org_id: getTenantId() }, 'sent_today', 1)
}

export async function resetSentTodayCounts(): Promise<void> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  await repo.createQueryBuilder()
    .update(EmailAccountEntity)
    .set({ sent_today: 0 })
    .execute()
}
