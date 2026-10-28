import { Controller, type RequestContext } from 'katal';
import { RecordService } from '../../services/RecordService';
import { listRecordsQuerySchema } from '../../common';
import { resolveOrgId } from './helpers';

export class ListRecordsController extends Controller {
  static __paramTokens = [RecordService];

  constructor(private recordService: RecordService) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      const orgId = resolveOrgId(context);
      const url = new URL(context.request.url);
      const queryParams = Object.fromEntries(url.searchParams);
      const validated = listRecordsQuerySchema.parse(queryParams);

      const result = await this.recordService.listRecords(orgId, validated);
      return this.success(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.badRequest(message || 'Failed to list records');
    }
  }
}
