import type { Application } from 'katal';
import { ListRecordsController } from './ListRecordsController';
import { UpsertRecordController } from './UpsertRecordController';
import { GetRecordController } from './GetRecordController';
import { DeleteRecordController } from './DeleteRecordController';

export * from './ListRecordsController';
export * from './UpsertRecordController';
export * from './GetRecordController';
export * from './DeleteRecordController';

export function registerRecordRoutes(app: Application) {
  app.get('/api/v1/records', ListRecordsController);
  app.post('/api/v1/records/upsert', UpsertRecordController);
  app.get('/api/v1/records/:id', GetRecordController);
  app.delete('/api/v1/records/:id', DeleteRecordController);
}
