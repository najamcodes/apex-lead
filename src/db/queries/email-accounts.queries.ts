import { getDataSource } from '../index'
import { EmailAccountEntity } from '../entities/EmailAccountEntity'
import type { EmailAccount, EmailAccountInsert } from '../../types'

export async function getEmailAccounts(): Promise<EmailAccount[]> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  // Omit passwords when sending to frontend ideally, but for now we'll just send it 
  // or the frontend can ignore it.
  const accounts = await repo.find({
    order: { created_at: 'ASC' }
  })
  return accounts as EmailAccount[]
}

export async function getEmailAccountById(id: number): Promise<EmailAccount | null> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  return await repo.findOneBy({ id }) as EmailAccount | null
}

export async function addEmailAccount(data: EmailAccountInsert): Promise<EmailAccount> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  const account = repo.create({
    email_address: data.email_address,
    app_password: data.app_password,
    sender_name: data.sender_name,
    daily_limit: data.daily_limit ?? 50
  })
  return await repo.save(account) as EmailAccount
}

export async function updateEmailAccount(id: number, data: Partial<EmailAccountInsert>): Promise<void> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  await repo.update(id, data)
}

export async function deleteEmailAccount(id: number): Promise<void> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  await repo.delete(id)
}

export async function incrementSentToday(id: number): Promise<void> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  await repo.increment({ id }, 'sent_today', 1)
}

export async function resetSentTodayCounts(): Promise<void> {
  const repo = getDataSource().getRepository(EmailAccountEntity)
  await repo.createQueryBuilder()
    .update(EmailAccountEntity)
    .set({ sent_today: 0 })
    .execute()
}
