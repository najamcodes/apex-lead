import type { RequestContext } from 'katal';
import { scoreSite } from '@sdk/core/ai/tasks/score-site';
import { draftOutreach } from '@sdk/core/ai/tasks/draft-outreach';
import { getSettings } from '../../db/queries/settings.queries';
import { sendError, HttpStatus } from '../../common';

export class AIController {
  /**
   * POST /api/ai/score-site
   */
  static async scoreSite(c: RequestContext): Promise<Response> {
    try {
      const { leadId, model } = c.req.valid ? c.req.valid('json') : await c.req.json();
      const settings = await getSettings();
      const result = await scoreSite(settings, leadId, model);
      return c.json(result);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /api/ai/draft-email
   */
  static async draftEmail(c: RequestContext): Promise<Response> {
    try {
      const { leadId, model } = c.req.valid ? c.req.valid('json') : await c.req.json();
      const settings = await getSettings();
      const result = await draftOutreach(settings, leadId, settings.developer_name ?? 'Your Name', model);
      return c.json(result);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /api/ai/test-connection
   */
  static async testConnection(c: RequestContext): Promise<Response> {
    const body = (await c.req.json().catch(() => ({}))) || {};
    const currentSettings = await getSettings();
    const mergedSettings = { ...currentSettings, ...body };
    const { AIClient } = await import('@sdk/core/ai/ai-client');
    const client = new AIClient(mergedSettings);

    const testModel =
      body.model ||
      (mergedSettings.ai_provider === 'anthropic' || mergedSettings.ai_provider === 'custom_claude'
        ? 'claude-3-5-sonnet-20241022'
        : mergedSettings.ai_provider === 'ollama'
        ? 'llama3'
        : mergedSettings.ai_provider === 'lmstudio'
        ? 'default'
        : mergedSettings.ai_model_site_scoring || 'gpt-4o-mini');

    const start = Date.now();
    try {
      const res = await client.complete({
        model: testModel,
        messages: [{ role: 'user', content: 'Reply with the exact word "PONG" and nothing else.' }],
        max_tokens: 20,
        temperature: 0.1,
      });
      const latencyMs = Date.now() - start;
      return c.json({
        ok: true,
        provider: mergedSettings.ai_provider,
        model: res.model || testModel,
        response: res.content.trim(),
        latencyMs,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return c.json(
        {
          ok: false,
          provider: mergedSettings.ai_provider,
          error: message,
          latencyMs: Date.now() - start,
        },
        400
      );
    }
  }
}
