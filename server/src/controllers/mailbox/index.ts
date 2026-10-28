import type { Application } from 'katal';
import { ListMailboxesController } from './ListMailboxesController';
import { CreateMailboxController } from './CreateMailboxController';
import { AuditMailboxController } from './AuditMailboxController';

export * from './ListMailboxesController';
export * from './CreateMailboxController';
export * from './AuditMailboxController';

export function registerMailboxRoutes(app: Application) {
  app.get('/api/v1/mailboxes', ListMailboxesController);
  app.post('/api/v1/mailboxes', CreateMailboxController);
  app.post('/api/v1/mailboxes/:id/audit', AuditMailboxController);
}
