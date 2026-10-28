import { Controller, type RequestContext } from 'katal';
import { RecordService } from '../../services/RecordService';
import { recordIdParamSchema } from '../../common';
import { resolveOrgId } from './helpers';

export class DeleteRecordController extends Controller {
  static __paramTokens = [RecordService];

  constructor(private recordService: RecordService) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      const orgId = resolveOrgId(context);
      const params = context.params || {};
      const { id } = recordIdParamSchema.parse(params);

      await this.recordService.deleteRecord(orgId, id);
      return this.success({ deleted: true, id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.notFound(message || 'Failed to delete record');
    }
  }
}
