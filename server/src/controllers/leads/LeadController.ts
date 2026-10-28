import type { RequestContext } from 'katal';
import { getAllLeads, getLeadById, insertLead, updateLeadStatus, deleteLead, insertBatchLeads } from '../../db/queries/leads.queries';
import { logActivity } from '../../db/queries/activity.queries';
import { getDashboardStats, getCityRoiStats, getChartData, getFunnelData } from '../../db/queries/stats.queries';
import { LeadResponseAdapter } from '../../adapters/lead.adapter';
import { sendSuccess, sendError, HttpStatus } from '../../common';
import type { LeadFilters, LeadInsert } from '@sdk/core/types';

export class LeadController {
  /**
   * GET /api/leads
   */
  static async getAll(c: RequestContext): Promise<Response> {
    try {
      const query = c.req.valid ? c.req.valid('query') : c.req.query();
      const result = await getAllLeads(query as unknown as LeadFilters);
      return c.json(result);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/leads/:id
   */
  static async getById(c: RequestContext): Promise<Response> {
    try {
      const paramVal = c.req.valid ? c.req.valid('param') : c.req.param();
      const id = typeof paramVal === 'object' && paramVal !== null ? Number(paramVal.id) : Number(paramVal);
      const result = await getLeadById(id);
      if (!result) {
        return c.json({ error: 'Lead not found' }, 404);
      }
      return c.json(result);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/leads
   */
  static async create(c: RequestContext): Promise<Response> {
    try {
      const body = c.req.valid ? c.req.valid('json') : await c.req.json();
      const result = await insertLead(body);
      if (!result) {
        return c.json({ error: 'Lead already exists' }, 409);
      }
      return c.json(result, 201);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /api/leads/batch
   */
  static async batchCreate(c: RequestContext): Promise<Response> {
    try {
      const body = c.req.valid ? c.req.valid('json') : await c.req.json();
      const leads = (body?.leads || []) as LeadInsert[];
      const result = await insertBatchLeads(leads);
      return c.json(result);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * PATCH /api/leads/:id/status
   */
  static async updateStatus(c: RequestContext): Promise<Response> {
    try {
      const paramVal = c.req.valid ? c.req.valid('param') : c.req.param();
      const id = typeof paramVal === 'object' && paramVal !== null ? Number(paramVal.id) : Number(paramVal);
      const body = c.req.valid ? c.req.valid('json') : await c.req.json();
      const { status, notes } = body;

      await updateLeadStatus(id, status, notes);
      if (status === 'approved') await logActivity(id, 'lead_approved', notes);
      if (status === 'skipped') await logActivity(id, 'lead_skipped', notes);

      return c.json({ success: true });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * DELETE /api/leads/:id
   */
  static async delete(c: RequestContext): Promise<Response> {
    try {
      const paramVal = c.req.valid ? c.req.valid('param') : c.req.param();
      const id = typeof paramVal === 'object' && paramVal !== null ? Number(paramVal.id) : Number(paramVal);
      await deleteLead(id);
      return c.json({ success: true });
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/stats/dashboard
   */
  static async getDashboardStats(c: RequestContext): Promise<Response> {
    try {
      const result = await getDashboardStats();
      return c.json(result);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/stats/city-roi
   */
  static async getCityRoiStats(c: RequestContext): Promise<Response> {
    try {
      const result = await getCityRoiStats();
      return c.json(result);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/stats/chart-data
   */
  static async getChartData(c: RequestContext): Promise<Response> {
    try {
      const weekly = await getChartData(14);
      const funnel = await getFunnelData();
      return c.json({ weekly, funnel }, 200);
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
