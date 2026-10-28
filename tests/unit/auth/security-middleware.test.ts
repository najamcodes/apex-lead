import '../../../server/polyfill'
import { describe, it, expect, beforeAll } from 'bun:test'
import { initDb, getDataSource } from '@sdk/core/db'
import { authMiddleware } from '../../../server/src/middleware/AuthMiddleware'
import { requireRole } from '../../../server/src/middleware/RequireRole'
import { rateLimit, resetRateLimits } from '../../../server/src/middleware/RateLimitMiddleware'
import { AuditService } from '../../../server/src/services/AuditService'
import { generateAccessToken } from '../../../server/src/auth/jwt'
import { getTenantId } from '../../../server/src/context'

describe('Session Security, JWT, Rate Limiting & Audit Logging (Prompt 03)', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = ''
    process.env.JWT_SECRET = 'test_jwt_secret_12345'
    process.env.REFRESH_SECRET = 'test_refresh_secret_12345'
    await initDb()
  })

  describe('AuthMiddleware & TenantContext Injection', () => {
    it('should inject user and tenant scope into context when a valid Bearer token is provided', async () => {
      const token = generateAccessToken({
        userId: 42,
        email: 'dev@saas.com',
        orgId: 101,
        role: 'admin',
        systemRole: 'user',
      })

      const req = new Request('http://localhost:4000/api/v1/protected', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const context: any = { request: req }

      let nextCalled = false
      let observedTenantId: number | null = null

      const mw = authMiddleware()
      await mw(context, async () => {
        nextCalled = true
        observedTenantId = getTenantId()
      })

      expect(nextCalled).toBe(true)
      expect(context.user).toBeDefined()
      expect(context.user.id).toBe(42)
      expect(context.user.orgId).toBe(101)
      expect(context.user.role).toBe('admin')
      expect(observedTenantId).toBe(101)
    })

    it('should reject requests with invalid or missing tokens with HTTP 401', async () => {
      const mw = authMiddleware()

      // Missing header
      const reqMissing = new Request('http://localhost:4000/api/v1/protected')
      const resMissing = await mw({ request: reqMissing }, async () => {})
      expect(resMissing).toBeInstanceOf(Response)
      expect(resMissing.status).toBe(401)

      // Malformed token
      const reqMalformed = new Request('http://localhost:4000/api/v1/protected', {
        headers: { Authorization: 'Bearer invalid.token.payload' },
      })
      const resMalformed = await mw({ request: reqMalformed }, async () => {})
      expect(resMalformed).toBeInstanceOf(Response)
      expect(resMalformed.status).toBe(401)
    })
  })

  describe('RequireRole Authorization Guard', () => {
    it('should permit access when user role meets or exceeds required hierarchy level', async () => {
      const guard = requireRole('admin')

      // Owner (level 5) > Admin (level 4) -> Allowed
      let ownerNext = false
      await guard({ user: { role: 'owner' } }, async () => { ownerNext = true })
      expect(ownerNext).toBe(true)

      // Admin (level 4) >= Admin (level 4) -> Allowed
      let adminNext = false
      await guard({ user: { role: 'admin' } }, async () => { adminNext = true })
      expect(adminNext).toBe(true)
    })

    it('should return HTTP 403 Forbidden when user role is below minimum required level', async () => {
      const guard = requireRole('admin')

      // Viewer (level 1) < Admin (level 4) -> 403
      const resViewer = await guard({ user: { role: 'viewer' } }, async () => {})
      expect(resViewer).toBeInstanceOf(Response)
      expect(resViewer.status).toBe(403)

      // Regular user (level 2) < Admin (level 4) -> 403
      const resUser = await guard({ user: { role: 'user' } }, async () => {})
      expect(resUser).toBeInstanceOf(Response)
      expect(resUser.status).toBe(403)
    })
  })

  describe('RateLimitMiddleware Sliding Window', () => {
    it('should allow requests within limit and trigger HTTP 429 when max requests are exceeded', async () => {
      resetRateLimits()
      const limiter = rateLimit({ windowSeconds: 2, maxRequests: 5 })

      const req = new Request('http://localhost:4000/api/v1/endpoint', {
        headers: { 'x-real-ip': '192.168.1.50' },
      })
      const context = { request: req, user: { orgId: 888 } }

      // Fire 5 allowed requests
      for (let i = 0; i < 5; i++) {
        let called = false
        const res = await limiter(context, async () => { called = true })
        expect(called).toBe(true)
      }

      // 6th request should hit rate limit
      const blockedRes = await limiter(context, async () => {})
      expect(blockedRes).toBeInstanceOf(Response)
      expect(blockedRes.status).toBe(429)
      expect(blockedRes.headers.get('Retry-After')).toBe('2')
    })
  })

  describe('AuditService Event Logging', () => {
    it('should record sensitive operations into audit_logs and retrieve them with tenant scoping', async () => {
      const audit = new AuditService()
      const orgId = 777

      await audit.log({
        orgId,
        userId: 10,
        action: 'lead.bulk_exported',
        resourceType: 'leads',
        resourceId: 'export_job_123',
        metadata: { rowCount: 500, format: 'csv' },
        ipAddress: '10.0.0.1',
      })

      const logs = await audit.listAuditLogs(orgId)
      expect(logs.total).toBeGreaterThanOrEqual(1)

      const entry = logs.items.find(e => e.action === 'lead.bulk_exported')
      expect(entry).toBeDefined()
      expect(entry!.user_id).toBe(10)
      expect(entry!.resource_type).toBe('leads')
      expect(entry!.metadata).toContain('"rowCount":500')
    })
  })
})
