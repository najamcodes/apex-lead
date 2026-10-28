import { Controller, type RequestContext } from 'katal';
import { DnsDeliverabilityAuditor } from '../../services/mail/DnsDeliverabilityAuditor';
import { getDataSource } from '../../db';
import { MailboxEntity } from '../../db/entities/MailboxEntity';
import { MailboxIdParamSchema } from '../../common';

export class AuditMailboxController extends Controller {
  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const { id } = MailboxIdParamSchema.parse(context.params || {});
      const repo = getDataSource().getRepository(MailboxEntity);
      const mailbox = await repo.findOne({ where: { id, org_id: orgId } });

      if (!mailbox) {
        return this.notFound('Mailbox not found');
      }

      const domain = mailbox.email.split('@')[1];
      const auditReport = await DnsDeliverabilityAuditor.auditDomain(domain);

      mailbox.reputation_score = auditReport.score;
      await repo.save(mailbox);

      return this.success(auditReport);
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Failed to audit mailbox domain');
    }
  }
}
