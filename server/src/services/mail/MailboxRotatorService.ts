import { DataSource, In } from 'typeorm'
import { MailboxEntity } from '../../db/entities/MailboxEntity'

export class MailboxRotatorService {
  constructor(private dataSource: DataSource) {}

  public async addMailbox(
    orgId: number,
    data: {
      email: string
      fromName: string
      provider?: string
      smtpHost: string
      smtpPort?: number
      smtpUsername: string
      smtpPasswordEncrypted: string
      dailyQuota?: number
    }
  ): Promise<MailboxEntity> {
    const repo = this.dataSource.getRepository(MailboxEntity)
    const mailbox = repo.create({
      org_id: orgId,
      email: data.email.toLowerCase().trim(),
      from_name: data.fromName,
      provider: data.provider || 'custom_smtp',
      smtp_host: data.smtpHost,
      smtp_port: data.smtpPort || 587,
      smtp_username: data.smtpUsername,
      smtp_password_encrypted: data.smtpPasswordEncrypted,
      daily_quota: data.dailyQuota || 40,
      current_day_sends: 0,
      warmup_enabled: true,
      warmup_day: 1,
      status: 'warming',
    })
    return repo.save(mailbox)
  }

  /**
   * Round-robin selection of the least-loaded eligible mailbox for an organization.
   */
  public async getNextAvailableMailbox(orgId: number): Promise<MailboxEntity | null> {
    const repo = this.dataSource.getRepository(MailboxEntity)

    // Select active or warming mailboxes belonging to this org
    const mailboxes = await repo.find({
      where: {
        org_id: orgId,
        status: In(['active', 'warming']),
      },
      order: { current_day_sends: 'ASC' },
    })

    // Filter to those under their daily limit
    const eligible = mailboxes.find((m) => m.current_day_sends < m.daily_quota)
    return eligible || null
  }

  public async recordSend(mailboxId: string): Promise<void> {
    const repo = this.dataSource.getRepository(MailboxEntity)
    const mailbox = await repo.findOne({ where: { id: mailboxId } })
    if (mailbox) {
      mailbox.current_day_sends += 1
      await repo.save(mailbox)
    }
  }

  public async resetDailyQuotas(): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(MailboxEntity)
      .set({ current_day_sends: 0 })
      .execute()
  }
}
