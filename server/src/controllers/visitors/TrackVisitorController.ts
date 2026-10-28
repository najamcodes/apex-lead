import { Controller, type RequestContext } from 'katal';
import { VisitorSessionService } from '../../services/visitors/VisitorSessionService';
import { TrackVisitorSchema } from '../../common';

export class TrackVisitorController extends Controller {
  static __paramTokens = [VisitorSessionService];

  constructor(private sessionService: VisitorSessionService) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
      const validated = TrackVisitorSchema.parse(body);

      const forwarded = context.request?.headers?.get('x-forwarded-for') || context.req?.header('x-forwarded-for');
      const remoteIp = (typeof forwarded === 'string' ? forwarded.split(',')[0] : '127.0.0.1').trim();

      const { session } = await this.sessionService.trackEvent({
        siteKey: validated.siteKey,
        sessionId: validated.sessionId,
        ip: remoteIp,
        path: validated.path,
        referrer: validated.referrer,
        durationSeconds: validated.durationSeconds,
      });

      return this.success({ recorded: Boolean(session) });
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Failed to process tracking beacon');
    }
  }
}
