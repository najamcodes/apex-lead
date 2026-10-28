import { Controller, type RequestContext } from 'katal';
import { getDataSource } from '../../db';
import { VoiceCampaignEntity } from '../../db/entities/VoiceCampaignEntity';
import { CreateVoiceCampaignSchema } from '../../common';

export class CreateVoiceCampaignController extends Controller {
  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = CreateVoiceCampaignSchema.parse(rawBody);

      const repo = getDataSource().getRepository(VoiceCampaignEntity);
      const campaign = repo.create({
        org_id: orgId,
        name: validated.name,
        voice_provider: validated.voiceProvider,
        assistant_id: validated.assistantId,
        system_prompt_template: validated.systemPromptTemplate,
        first_sentence_template: validated.firstSentenceTemplate,
        phone_number_id: validated.phoneNumberId,
      });
      await repo.save(campaign);

      return this.json(campaign, 201);
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Failed to create voice campaign');
    }
  }
}
