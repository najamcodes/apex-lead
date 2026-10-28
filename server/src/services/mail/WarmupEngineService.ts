import { DataSource } from 'typeorm'
import { MailboxEntity } from '../../db/entities/MailboxEntity'

export class WarmupEngineService {
  constructor(private dataSource: DataSource) {}

  /**
   * Calculates progressive maximum daily sends according to standard 21-day ramp curve.
   */
  public getRampQuotaForDay(day: number): number {
    if (day <= 3) return 5
    if (day <= 7) return 15
    if (day <= 14) return 25
    if (day <= 21) return 40
    return 50 // Day 22+ fully warmed
  }

  public async advanceWarmupDay(mailboxId: string): Promise<MailboxEntity | null> {
    const repo = this.dataSource.getRepository(MailboxEntity)
    const mailbox = await repo.findOne({ where: { id: mailboxId } })
    if (!mailbox || !mailbox.warmup_enabled) return null

    mailbox.warmup_day += 1
    mailbox.daily_quota = this.getRampQuotaForDay(mailbox.warmup_day)

    if (mailbox.warmup_day >= 22 && mailbox.status === 'warming') {
      mailbox.status = 'active'
    }

    return repo.save(mailbox)
  }
}
