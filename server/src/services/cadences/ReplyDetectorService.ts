import { DataSource } from 'typeorm'
import { CadenceEnrollmentEntity } from '../../db/entities/CadenceEnrollmentEntity'

export interface IncomingReplyEvent {
  fromEmail: string
  subject: string
  bodySnippet?: string
  receivedAt?: Date
}

export class ReplyDetectorService {
  constructor(private dataSource: DataSource) {}

  /**
   * Processes incoming reply; halts future cadence steps immediately.
   */
  public async handleIncomingReply(event: IncomingReplyEvent): Promise<{ haltedCount: number }> {
    const cleanEmail = event.fromEmail.toLowerCase().trim()
    const enrollmentRepo = this.dataSource.getRepository(CadenceEnrollmentEntity)

    // Find all non-completed enrollments for this recipient
    const activeEnrollments = await enrollmentRepo.find({
      where: [
        { recipient_email: cleanEmail, status: 'queued' },
        { recipient_email: cleanEmail, status: 'in_progress' },
      ],
    })

    if (activeEnrollments.length === 0) {
      return { haltedCount: 0 }
    }

    // Mark as replied and pause future dispatches
    for (const enrollment of activeEnrollments) {
      enrollment.status = 'replied'
      await enrollmentRepo.save(enrollment)
    }

    return { haltedCount: activeEnrollments.length }
  }
}
