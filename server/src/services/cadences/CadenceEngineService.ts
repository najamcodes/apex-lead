import { DataSource, LessThanOrEqual, In } from 'typeorm'
import { CadenceEntity } from '../../db/entities/CadenceEntity'
import { CadenceStepEntity } from '../../db/entities/CadenceStepEntity'
import { CadenceEnrollmentEntity } from '../../db/entities/CadenceEnrollmentEntity'
import { SpintaxParser } from './SpintaxParser'

export class CadenceEngineService {
  constructor(private dataSource: DataSource) {}

  public async createCadence(orgId: number, name: string, dailyLimit = 100): Promise<CadenceEntity> {
    const repo = this.dataSource.getRepository(CadenceEntity)
    const cadence = repo.create({
      org_id: orgId,
      name,
      status: 'active',
      daily_limit: dailyLimit,
    })
    return repo.save(cadence)
  }

  public async addStep(
    cadenceId: string,
    stepNumber: number,
    delayDays: number,
    subjectTemplate: string,
    bodyTemplate: string
  ): Promise<CadenceStepEntity> {
    const repo = this.dataSource.getRepository(CadenceStepEntity)
    const step = repo.create({
      cadence_id: cadenceId,
      step_number: stepNumber,
      delay_days: delayDays,
      subject_template: subjectTemplate,
      body_template: bodyTemplate,
    })
    return repo.save(step)
  }

  public async enrollRecord(
    orgId: number,
    cadenceId: string,
    recordId: string,
    recipientEmail: string
  ): Promise<CadenceEnrollmentEntity> {
    const repo = this.dataSource.getRepository(CadenceEnrollmentEntity)
    const cleanEmail = recipientEmail.toLowerCase().trim()

    const existing = await repo.findOne({
      where: { cadence_id: cadenceId, record_id: recordId },
    })
    if (existing) {
      return existing
    }

    const nextSendAt = new Date() // immediate initial send
    const enrollment = repo.create({
      org_id: orgId,
      cadence_id: cadenceId,
      record_id: recordId,
      recipient_email: cleanEmail,
      current_step: 1,
      status: 'queued',
      next_send_at: nextSendAt,
    })
    return repo.save(enrollment)
  }

  public async getDueEnrollments(limit = 50): Promise<CadenceEnrollmentEntity[]> {
    const repo = this.dataSource.getRepository(CadenceEnrollmentEntity)
    return repo.find({
      where: {
        status: In(['queued', 'in_progress']),
        next_send_at: LessThanOrEqual(new Date()),
      },
      take: limit,
      order: { next_send_at: 'ASC' },
    })
  }

  public async processStepForEnrollment(
    enrollmentId: string,
    recordVariables: Record<string, unknown> = {}
  ): Promise<{
    subject: string
    body: string
    completed: boolean
    nextStepNumber?: number
  }> {
    const enrollRepo = this.dataSource.getRepository(CadenceEnrollmentEntity)
    const stepRepo = this.dataSource.getRepository(CadenceStepEntity)

    const enrollment = await enrollRepo.findOne({ where: { id: enrollmentId } })
    if (!enrollment) {
      throw new Error(`Enrollment not found: ${enrollmentId}`)
    }

    const currentStep = await stepRepo.findOne({
      where: {
        cadence_id: enrollment.cadence_id,
        step_number: enrollment.current_step,
      },
    })

    if (!currentStep) {
      enrollment.status = 'completed'
      await enrollRepo.save(enrollment)
      return { subject: '', body: '', completed: true }
    }

    // Render spintax and variables
    const subject = SpintaxParser.parse(currentStep.subject_template, recordVariables)
    const body = SpintaxParser.parse(currentStep.body_template, recordVariables)

    // Check next step
    const nextStep = await stepRepo.findOne({
      where: {
        cadence_id: enrollment.cadence_id,
        step_number: enrollment.current_step + 1,
      },
    })

    if (nextStep) {
      enrollment.current_step += 1
      enrollment.status = 'in_progress'
      const nextDate = new Date()
      nextDate.setDate(nextDate.getDate() + nextStep.delay_days)
      enrollment.next_send_at = nextDate
      await enrollRepo.save(enrollment)
      return { subject, body, completed: false, nextStepNumber: enrollment.current_step }
    } else {
      enrollment.status = 'completed'
      await enrollRepo.save(enrollment)
      return { subject, body, completed: true }
    }
  }
}
