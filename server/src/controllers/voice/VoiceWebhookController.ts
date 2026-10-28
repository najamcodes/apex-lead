import { Controller, type RequestContext } from 'katal';
import { VoiceAiService } from '../../services/voice/VoiceAiService';
import { VoiceWebhookSchema } from '../../common';

export class VoiceWebhookController extends Controller {
  static __paramTokens = [VoiceAiService];

  constructor(private voiceService: VoiceAiService) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = VoiceWebhookSchema.parse(rawBody);

      const call = await this.voiceService.handleCallCompletion(validated.callSid, {
        durationSeconds: validated.durationSeconds,
        transcript: validated.transcript,
        summary: validated.summary,
        sentimentScore: validated.sentimentScore,
        appointmentBooked: validated.appointmentBooked,
        appointmentTime: validated.appointmentTime ? new Date(validated.appointmentTime) : undefined,
        answers: validated.answers,
      });

      return this.success({ updated: Boolean(call) });
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Failed to process voice webhook');
    }
  }
}
