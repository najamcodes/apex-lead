import { Controller, type RequestContext } from 'katal';
import { MailboxRotatorService } from '../../services/mail/MailboxRotatorService';
import { CreateMailboxSchema } from '../../common';

export class CreateMailboxController extends Controller {
  static __paramTokens = [MailboxRotatorService];

  constructor(private rotatorService: MailboxRotatorService) {
    super();
  }

  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = CreateMailboxSchema.parse(rawBody);

      const mailbox = await this.rotatorService.addMailbox(orgId, {
        email: validated.email,
        fromName: validated.fromName || validated.email.split('@')[0],
        smtpHost: validated.smtpHost,
        smtpPort: validated.smtpPort,
        smtpUsername: validated.smtpUsername,
        smtpPasswordEncrypted: validated.smtpPassword,
      });

      return this.json(mailbox, 201);
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Failed to connect mailbox');
    }
  }
}
