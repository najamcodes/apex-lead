import { Controller, type RequestContext } from 'katal';
import { getDataSource } from '../../db';
import { VisitorSiteEntity } from '../../db/entities/VisitorSiteEntity';
import { RegisterSiteSchema } from '../../common';
import crypto from 'node:crypto';

export class RegisterSiteController extends Controller {
  async handle(context: RequestContext) {
    const orgId = context.user?.orgId || context.state?.tenantId;
    if (!orgId) return this.unauthorized('Authentication required');

    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = RegisterSiteSchema.parse(rawBody);

      const repo = getDataSource().getRepository(VisitorSiteEntity);
      const apiKey = `al_site_${crypto.randomBytes(24).toString('hex')}`;

      const site = repo.create({
        org_id: orgId,
        domain: validated.domain.toLowerCase().trim(),
        api_key: apiKey,
        slack_webhook_url: validated.slackWebhookUrl || undefined,
      });
      await repo.save(site);

      return this.json({
        site,
        embedCode: `<script src="https://api.apexlead.ai/tracker.js" data-site="${apiKey}" async></script>`,
      }, 201);
    } catch (err: unknown) {
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.badRequest(message || 'Failed to register site');
    }
  }
}
