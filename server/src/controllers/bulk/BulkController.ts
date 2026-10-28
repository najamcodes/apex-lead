import type { RequestContext } from 'katal';
import { wsHub } from '../../ws';
import { analyzeBatch } from '@sdk/core/analysis';
import { scoreSite } from '@sdk/core/ai/tasks/score-site';
import { getSettings } from '../../db/queries/settings.queries';
import { getDataSource } from '../../db';
import { getTenantId } from '../../db/queries/tenant';
import { logActivity, getActivityByLead, getRecentActivity } from '../../db/queries/activity.queries';
import { getNoteByLead, saveNote } from '../../db/queries/notes.queries';
import { EmailTemplateEntity } from '../../db/entities/EmailTemplateEntity';
import { LeadEntity } from '../../db/entities/LeadEntity';
import { createSequenceForLead } from '@sdk/core/outreach';
import { parseSpintax } from '@sdk/core/outreach/spintax';
import { draftOutreach } from '@sdk/core/ai/tasks/draft-outreach';
import { updateLeadStatus } from '../../db/queries/leads.queries';
import { sendError, HttpStatus } from '../../common';

export class BulkController {
  /**
   * GET /api/bulk/leads/:id/notes
   */
  static async getLeadNotes(c: RequestContext): Promise<Response> {
    try {
      const paramVal = c.req.valid ? c.req.valid('param') : c.req.param();
      const id = typeof paramVal === 'object' && paramVal !== null ? Number(paramVal.id) : Number(paramVal);
      const note = await getNoteByLead(id);
      return c.json(note);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * PUT /api/bulk/leads/:id/notes
   */
  static async saveLeadNote(c: RequestContext): Promise<Response> {
    try {
      const paramVal = c.req.valid ? c.req.valid('param') : c.req.param();
      const id = typeof paramVal === 'object' && paramVal !== null ? Number(paramVal.id) : Number(paramVal);
      const bodyPayload = c.req.valid ? c.req.valid('json') : await c.req.json();
      const { body } = bodyPayload;
      await logActivity(id, 'note_added', 'Added a note to the lead');
      const note = await saveNote(id, body);
      return c.json(note);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/bulk/leads/:id/activity
   */
  static async getLeadActivity(c: RequestContext): Promise<Response> {
    try {
      const paramVal = c.req.valid ? c.req.valid('param') : c.req.param();
      const id = typeof paramVal === 'object' && paramVal !== null ? Number(paramVal.id) : Number(paramVal);
      const activity = await getActivityByLead(id);
      return c.json(activity);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/bulk/activity/recent
   */
  static async getRecentActivity(c: RequestContext): Promise<Response> {
    try {
      const query = c.req.valid ? c.req.valid('query') : c.req.query();
      const limit = query?.limit ? Number(query.limit) : 20;
      const activity = await getRecentActivity(limit);
      return c.json(activity);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/bulk/analyze
   */
  static async bulkAnalyze(c: RequestContext): Promise<Response> {
    try {
      const { leadIds } = c.req.valid ? c.req.valid('json') : await c.req.json();
      analyzeBatch(leadIds, (done: number, total: number, leadId: number) => {
        wsHub.broadcast('analysis:progress', { done, total, leadId });
      }).catch(console.error);
      return c.json({ status: 'started', total: leadIds.length }, 202);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /api/bulk/score
   */
  static async bulkScore(c: RequestContext): Promise<Response> {
    try {
      const { leadIds, model } = c.req.valid ? c.req.valid('json') : await c.req.json();
      const settings = await getSettings();
      (async () => {
        let completed = 0;
        for (const id of leadIds) {
          try {
            await scoreSite(settings, id, model);
            completed++;
            wsHub.broadcast('score:progress', { completed, total: leadIds.length, leadId: id });
          } catch {}
        }
      })().catch(console.error);
      return c.json({ status: 'started', total: leadIds.length }, 202);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /api/bulk/approve
   */
  static async bulkApprove(c: RequestContext): Promise<Response> {
    try {
      const { leadIds } = c.req.valid ? c.req.valid('json') : await c.req.json();
      let updated = 0;
      for (const id of leadIds) {
        await updateLeadStatus(id, 'approved');
        await logActivity(id, 'lead_approved', 'Batch approved');
        updated++;
      }
      return c.json({ updated });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/bulk/schedule-sequences
   */
  static async bulkScheduleSequences(c: RequestContext): Promise<Response> {
    try {
      const { leadIds, templateId } = c.req.valid ? c.req.valid('json') : await c.req.json();
      const ds = getDataSource();
      const templateRepo = ds.getRepository(EmailTemplateEntity);
      const leadRepo = ds.getRepository(LeadEntity);

      let template: EmailTemplateEntity | null = null;
      if (templateId) {
        template = await templateRepo.findOne({ where: { id: templateId, org_id: getTenantId() } });
      }

      let scheduled = 0;
      const settings = await getSettings();

      for (const leadId of leadIds) {
        try {
          const lead = await leadRepo.findOne({ where: { id: leadId, org_id: getTenantId() } });
          if (lead && lead.email) {
            let subject = '';
            let body = '';

            if (template) {
              subject = template.subject
                .replace(/{{business_name}}/gi, lead.business_name || '')
                .replace(/{{city}}/gi, lead.city || '')
                .replace(/{{ai_hook}}/gi, lead.ai_personalized_hook || '');

              body = template.body
                .replace(/{{business_name}}/gi, lead.business_name || '')
                .replace(/{{city}}/gi, lead.city || '')
                .replace(/{{ai_hook}}/gi, lead.ai_personalized_hook || '');

              subject = parseSpintax(subject);
              body = parseSpintax(body);
            } else if (settings.ai_enabled) {
              const draft = await draftOutreach(
                settings,
                leadId,
                settings.developer_name || 'Your Name',
                settings.ai_model_email_draft
              );
              subject = draft.subject;
              body = draft.email_body;
            }

            await createSequenceForLead(
              {
                lead_id: leadId,
                email: lead.email,
                subject,
                email_body: body,
              },
              lead.business_name
            );

            await logActivity(leadId, 'sequence_started', template ? `Template: ${template.name}` : 'AI Generated');
            scheduled++;
          }
        } catch {}
      }

      return c.json({ scheduled });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
