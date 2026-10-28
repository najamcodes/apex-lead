import type { RequestContext } from 'katal'
import {
  getAllProxyConfigs,
  createProxyConfig,
  getProxyConfigById,
  updateProxyConfig,
  deleteProxyConfig,
} from '../../db/queries/proxy-configs.queries'
import { sendError, HttpStatus } from '../../common'

export class ProxyConfigController {
  /**
   * GET /api/proxy-configs
   */
  static async list(c: RequestContext): Promise<Response> {
    try {
      const configs = await getAllProxyConfigs()
      return c.json({ success: true, proxy_configs: configs }, 200)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * GET /api/proxy-configs/:id
   */
  static async getById(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      const config = await getProxyConfigById(id)
      if (!config) return c.json({ error: 'Proxy config not found' }, 404)
      return c.json({ success: true, proxy_config: config })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * POST /api/proxy-configs
   */
  static async create(c: RequestContext): Promise<Response> {
    try {
      const body = await c.req.json()
      const config = await createProxyConfig(body)
      return c.json({ success: true, proxy_config: config }, 201)
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * PUT /api/proxy-configs/:id
   */
  static async update(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      const body = await c.req.json()
      const config = await updateProxyConfig(id, body)
      if (!config) return c.json({ error: 'Proxy config not found' }, 404)
      return c.json({ success: true, proxy_config: config })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * DELETE /api/proxy-configs/:id
   */
  static async delete(c: RequestContext): Promise<Response> {
    try {
      const id = Number(c.params?.id || c.req.param('id'))
      const deleted = await deleteProxyConfig(id)
      if (!deleted) return c.json({ error: 'Proxy config not found' }, 404)
      return c.json({ success: true })
    } catch (err: unknown) {
      return sendError(c, err, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
