import { Controller, type RequestContext } from 'katal';
import { ReplyDetectorService } from '../../services/cadences/ReplyDetectorService';
import { ReplyWebhookSchema } from '../../common';

export class ReplyWebhookController extends Controller {
  static __paramTokens = [ReplyDetectorService];

  constructor(private replyDetector: ReplyDetectorService) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = ReplyWebhookSchema.parse(rawBody);

      const result = await this.replyDetector.handleIncomingReply({
        fromEmail: validated.fromEmail,
        subject: validated.subject,
        bodySnippet: validated.bodySnippet,
      });
      return this.success({ haltedCount: result.haltedCount });
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Failed to handle reply event');
    }
  }
}
