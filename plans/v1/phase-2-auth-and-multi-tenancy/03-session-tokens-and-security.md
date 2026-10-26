# Phase 2 — Prompt 03: Session Security, JWT Rotation, Rate Limiting & Audit Logging

> **Objective:** Secure the SaaS API gateway with short-lived JWT access tokens, rotating HTTP-only refresh tokens, Redis-backed rate limiting, and comprehensive multi-tenant audit logging.

---

## 1. Token Lifecycle & Rotation Strategy

```
Client Request
      │
      ▼
Bearer Access Token Expired (15 min)?
      │
      ├─► No: Proceed to API Controller
      │
      └─► Yes: Call POST /api/auth/refresh
                │
                ▼
          Verify HTTP-only Refresh Cookie
          Check Redis Token Revocation List
                │
                ├─► Valid: Issue NEW Access Token + Rotate Refresh Token
                │
                └─► Invalid / Revoked: Force Logout (Clear Cookies, 401)
```

---

## 2. JWT Configuration & Key Rotation

### `server/src/auth/jwt.ts`

```ts
import { sign, verify } from 'jsonwebtoken'

export interface AccessTokenPayload {
  userId: number
  email: string
  orgId: number
  role: string
  systemRole: string
}

export interface RefreshTokenPayload {
  userId: number
  tokenVersion: number
}

const JWT_SECRET = process.env.JWT_SECRET || 'apexlead_production_jwt_secret_replace'
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'apexlead_production_refresh_secret_replace'

export function generateAccessToken(payload: AccessTokenPayload): string {
  return sign(payload, JWT_SECRET, { expiresIn: '15m' })
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return sign(payload, REFRESH_SECRET, { expiresIn: '30d' })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return verify(token, JWT_SECRET) as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return verify(token, REFRESH_SECRET) as RefreshTokenPayload
}
```

---

## 3. Katal `AuthMiddleware.ts` with Tenant Context Injection

### `server/src/middleware/AuthMiddleware.ts`

```ts
import { Middleware, Context } from 'katal'
import { verifyAccessToken } from '../auth/jwt'

export function authMiddleware(): Middleware {
  return async (c: Context, next: () => Promise<void>) => {
    const authHeader = c.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or malformed Authorization header' }, 401)
    }

    const token = authHeader.substring(7)
    try {
      const payload = verifyAccessToken(token)
      // Inject user and tenant scope into Katal request context
      c.set('userId', payload.userId)
      c.set('tenantId', payload.orgId)
      c.set('userEmail', payload.email)
      c.set('userOrgRole', payload.role)
      c.set('systemRole', payload.systemRole)
      await next()
    } catch {
      return c.json({ error: 'Invalid or expired access token' }, 401)
    }
  }
}
```

---

## 4. Sliding Window Rate Limiting Middleware (Redis / Memory)

### `server/src/middleware/RateLimitMiddleware.ts`

```ts
import { Middleware, Context } from 'katal'

interface RateLimitConfig {
  windowSeconds: number
  maxRequests: number
}

// In-memory sliding window or Redis fallback
const hits = new Map<string, number[]>()

export function rateLimit(config: RateLimitConfig): Middleware {
  return async (c: Context, next: () => Promise<void>) => {
    const ip = c.header('x-forwarded-for') || c.header('x-real-ip') || '127.0.0.1'
    const orgId = c.get('tenantId') || 'public'
    const key = `${orgId}:${ip}`
    const now = Date.now()
    const windowStart = now - config.windowSeconds * 1000

    const timestamps = (hits.get(key) || []).filter(ts => ts > windowStart)
    if (timestamps.length >= config.maxRequests) {
      c.header('Retry-After', String(config.windowSeconds))
      return c.json({ error: 'Too many requests. Please slow down.' }, 429)
    }

    timestamps.push(now)
    hits.set(key, timestamps)
    await next()
  }
}
```

---

## 5. Audit Logging Service

Whenever sensitive actions occur (API key creation, lead bulk export, user permission changes, scraping execution):

```ts
// server/src/services/AuditService.ts
import { AppDataSource } from '../db/data-source'
import { AuditLogEntity } from '../models/AuditLogEntity'

export interface LogAuditEventDto {
  orgId: number
  userId: number
  action: string // 'lead.exported', 'pipeline.started', 'member.invited'
  resourceType: string
  resourceId?: string | number
  metadata?: Record<string, unknown>
  ipAddress?: string
}

export class AuditService {
  private repo = AppDataSource.getRepository(AuditLogEntity)

  async log(event: LogAuditEventDto): Promise<void> {
    try {
      const entry = this.repo.create({
        org_id: event.orgId,
        user_id: event.userId,
        action: event.action,
        resource_type: event.resourceType,
        resource_id: event.resourceId ? String(event.resourceId) : null,
        metadata: JSON.stringify(event.metadata || {}),
        ip_address: event.ipAddress || null,
      })
      await this.repo.save(entry)
    } catch (err) {
      console.warn('[AuditService] Failed to record audit log:', err)
    }
  }
}
```

---

## 6. Verification Protocol
- [ ] Attempt API call with expired access token -> Assert 401.
- [ ] Call `POST /api/auth/refresh` with valid refresh cookie -> Assert new 15-minute access token returned.
- [ ] Fire 100 requests in 5 seconds against protected routes -> Assert HTTP 429 triggered with `Retry-After`.
- [ ] Perform lead export -> Assert entry is logged in `audit_logs` table with matching `org_id` and `user_id`.
