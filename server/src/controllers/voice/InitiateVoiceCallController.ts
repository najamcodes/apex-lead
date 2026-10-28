import { Controller, type RequestContext } from 'katal';
import { VoiceAiService } from '../../services/voice/VoiceAiService';
import { InitiateVoiceCallSchema } from '../../common';

export class InitiateVoiceCallController extends Controller {
  static __paramTokens = [VoiceAiService];

  constructor(private voiceService: VoiceAiService) {
    super();
  }

  async handle(context: RequestContext) {
    const orgId = Number(context.user?.orgId || (context.state as Record<string, unknown>)?.tenantId);
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = InitiateVoiceCallSchema.parse(rawBody);

      const call = await this.voiceService.initiateCall({
        orgId,
        campaignId: validated.campaignId,
        recordId: validated.recordId,
        recipientPhone: validated.recipientPhone,
        recordData: validated.recordData,
      });

      return this.json(call, 201);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      if (message && message.includes('Quota exceeded')) {
        return this.error(message, 402);
      }
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      return this.badRequest(message || 'Failed to initiate voice call');
    }
  }
}
