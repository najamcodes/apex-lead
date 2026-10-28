import { Controller, type RequestContext } from 'katal';
import { getDataSource } from '../../db';
import { MailboxEntity } from '../../db/entities/MailboxEntity';

export class ListMailboxesController extends Controller {
  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const repo = getDataSource().getRepository(MailboxEntity);
      const list = await repo.find({
        where: { org_id: orgId },
        order: { created_at: 'DESC' },
      });
      return this.success(list);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.badRequest(message || 'Failed to list mailboxes');
    }
  }
}
