import type { Application } from 'katal';
import { CreateCadenceController } from './CreateCadenceController';
import { AddCadenceStepController } from './AddCadenceStepController';
import { EnrollCadenceRecordController } from './EnrollCadenceRecordController';
import { ReplyWebhookController } from './ReplyWebhookController';

export * from './CreateCadenceController';
export * from './AddCadenceStepController';
export * from './EnrollCadenceRecordController';
export * from './ReplyWebhookController';

export function registerCadenceRoutes(app: Application) {
  app.post('/api/v1/cadences', CreateCadenceController);
  app.post('/api/v1/cadences/:id/steps', AddCadenceStepController);
  app.post('/api/v1/cadences/:id/enroll', EnrollCadenceRecordController);
  app.post('/api/v1/cadences/webhook/reply', ReplyWebhookController);
}
