import { Controller, type RequestContext } from 'katal';
import { RecordService } from '../../services/RecordService';
import { recordIdParamSchema } from '../../common';
import { resolveOrgId } from './helpers';

export class GetRecordController extends Controller {
  static __paramTokens = [RecordService];

  constructor(private recordService: RecordService) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      const orgId = resolveOrgId(context);
      const params = context.params || {};
      const { id } = recordIdParamSchema.parse(params);

      const record = await this.recordService.getRecordById(orgId, id);
      return this.success(record);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.notFound(message || 'Record not found');
    }
  }
}
