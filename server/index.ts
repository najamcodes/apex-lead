import './polyfill'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie } from 'hono/cookie'
import { serve } from '@hono/node-server'
import { verifyToken } from './src/auth'
import { wsHub } from './src/ws'
import { initDb, getDataSource } from '@sdk/backend/db'
import { UserEntity } from '@sdk/backend/db/entities/UserEntity'
import { initSentry, captureException, setUserContext } from './src/utils/sentry'
import { logger } from './src/utils/logger'
import { logRequest } from './src/middleware/logger'
import { rateLimiter } from './src/middleware/rateLimiter'
import { initPluginRegistry } from '@sdk/core/plugins'

import { leadsRouter, statsRouter } from './src/routes/leads'
import { authRouter, settingsRouter } from './src/routes/settings'
import { scraperRouter } from './src/routes/scraper'
import { apiRouter } from './src/routes/api'
import { aiRouter } from './src/routes/ai'
import { analysisRouter } from './src/routes/analysis'
import { outreachRouter } from './src/routes/outreach'
import { bulkRouter } from './src/routes/bulk'
import { emailFinderRouter } from './src/routes/email-finder'
import { emailVerifierRouter } from './src/routes/email-verifier'
import { schedulerRouter } from './src/routes/scheduler'
import { usersRouter } from './src/routes/users'
import { pipelinesRouter } from '@sdk/backend/routes/pipelines'
import { collectionsRouter } from '@sdk/backend/routes/collections'
import { analyticsRouter } from '@sdk/backend/routes/analytics'
import { approvalsRouter } from '@sdk/backend/routes/approvals'
import { aiConnectionsRouter } from '@sdk/backend/routes/ai-connections'
import { customNodesRouter } from '@sdk/backend/routes/custom-nodes'
import { orgRouter, proxyConfigRouter } from './src/routes/orgs'
import { workersRouter } from './src/routes/workers'
import { workerHub } from './src/ws/worker-hub'

import { runWithUser, type RequestUser } from './src/context'
import { UserOrganizationEntity } from '@sdk/backend/db/entities/UserOrganizationEntity'

declare global {
  var currentUserId: number | undefined;
  var currentOrgId: number | undefined;
  var currentUserRole: string | undefined;
  var currentUserPermissions: string[] | undefined;
}

// ── App setup ──────────────────────────────────────────────────────

export const app = new Hono()

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*'
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return origin
    }
    if (origin.startsWith('vscode-webview://') || origin.startsWith('file://')) {
      return origin
    }
    const envOrigins = process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || []
    if (envOrigins.includes(origin)) return origin
    return null
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Desktop-App', 'X-User-Id', 'X-Org-Id', 'X-Current-Role'],
}))

// ── Structured request logging (Pino) ──────────────────────────────

app.use('*', logRequest())

// ── Rate limiting ──────────────────────────────────────────────────

const globalLimiter = rateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  keyGenerator: (c) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    return `ip:${ip}`
  },
})

const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyGenerator: (c) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    return `auth:${ip}`
  },
})

app.use('/api/*', globalLimiter)
app.use('/api/auth/*', authLimiter)

// ── Auth middleware ────────────────────────────────────────────────

app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth/login') || c.req.path.startsWith('/api/auth/register')) {
    return next()
  }

  // 1. Try cookie
  let token = getCookie(c, 'leadhunter_token')

  // 2. Try Authorization: Bearer <token>
  if (!token) {
    const authHeader = c.req.header('authorization')
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.substring(7).trim()
    }
  }

  let resolvedUserId: number | null = null
  let resolvedOrgId: number | null = null

  if (token) {
    const payload = verifyToken(token) as any
    if (payload && payload.id) {
      resolvedUserId = Number(payload.id)
      if (payload.org_id) resolvedOrgId = Number(payload.org_id)
    }
  }

  // 3. Desktop / Local mode fallback:
  // When running in desktop mode or with X-Desktop-App header from local UI
  const isDesktopMode =
    process.env.NODE_ENV === 'desktop' ||
    c.req.header('x-desktop-app') === 'true'

  if (!resolvedUserId && isDesktopMode) {
    const headerUserId = c.req.header('x-user-id')
    if (headerUserId) {
      const parsed = parseInt(headerUserId, 10)
      if (!isNaN(parsed)) resolvedUserId = parsed
    }
    const headerOrgId = c.req.header('x-org-id')
    if (headerOrgId) {
      const parsedOrg = parseInt(headerOrgId, 10)
      if (!isNaN(parsedOrg)) resolvedOrgId = parsedOrg
    }

    // Default to global.currentUserId or 1 (primary administrator)
    if (!resolvedUserId) {
      resolvedUserId = global.currentUserId || 1
    }
  }

  if (!resolvedUserId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const userRepo = getDataSource().getRepository(UserEntity)
  let user = await userRepo.findOneBy({ id: resolvedUserId })

  // Desktop mode fallback if specific ID not found, resolve primary user
  if (!user && isDesktopMode) {
    user = await userRepo.findOne({ where: {}, order: { id: 'ASC' } })
  }

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Resolve current org: prefer resolvedOrgId, fallback to user's default_org_id, then 1
  const activeOrgId: number = resolvedOrgId ?? user.default_org_id ?? 1

  // Resolve org-specific role from user_organizations table
  let orgRole = user.role // fallback to global role (e.g. super_admin)
  let orgPermissions: string[] = JSON.parse(user.permissions || '[]')
  if (user.role !== 'super_admin') {
    try {
      const userOrgRepo = getDataSource().getRepository(UserOrganizationEntity)
      const link = await userOrgRepo.findOne({ where: { user_id: user.id, org_id: activeOrgId } })
      if (link) {
        orgRole = link.role
        orgPermissions = JSON.parse(link.permissions || '[]')
      }
    } catch {
      // fallback to user's global role if query fails
    }
  }

  const requestUser: RequestUser = {
    id: user.id,
    org_id: activeOrgId,
    role: orgRole,
    permissions: orgPermissions,
    name: user.name,
    email: user.email,
  }

  // Set Sentry user context for error tracking
  setUserContext({ id: String(user.id), email: user.email, role: orgRole })

  // Store full user on Hono context for direct access in route handlers
  ;(c as any).set('user', requestUser)

  // Set legacy globals for Electron / non-server contexts (backward compat)
  global.currentUserId = user.id
  global.currentOrgId = activeOrgId
  global.currentUserRole = orgRole
  global.currentUserPermissions = orgPermissions

  // PRIMARY: wrap next() in AsyncLocalStorage so all downstream calls
  // (queries, engine, plugins) get the correct per-request user context
  await runWithUser(requestUser, async () => { await next() })
})

// ── Routes ─────────────────────────────────────────────────────────

app.route('/api/leads', leadsRouter as any)
app.route('/api/stats', statsRouter as any)
app.route('/api/auth', authRouter as any)
app.route('/api/settings', settingsRouter as any)
app.route('/api/scraper', scraperRouter as any)
app.route('/api/ai', aiRouter as any)
app.route('/api/analysis', analysisRouter as any)
app.route('/api/outreach', outreachRouter as any)
app.route('/api/bulk', bulkRouter as any)
app.route('/api/email-finder', emailFinderRouter as any)
app.route('/api/email-verifier', emailVerifierRouter as any)
app.route('/api/scheduler', schedulerRouter as any)
app.route('/api/users', usersRouter as any)
app.route('/api/pipelines', pipelinesRouter as any)
app.route('/api/collections', collectionsRouter as any)
app.route('/api/analytics', analyticsRouter as any)
app.route('/api/approvals', approvalsRouter as any)
app.route('/api/ai-connections', aiConnectionsRouter as any)
app.route('/api/custom-nodes', customNodesRouter as any)
app.route('/api/workers', workersRouter as any)
app.route('/api/orgs', orgRouter as any)
app.route('/api/proxy-configs', proxyConfigRouter as any)
app.route('/api', apiRouter as any)

// ── OpenAPI / Swagger UI ───────────────────────────────────────────

app.get('/swagger', (c) => {
  return c.html(`<!DOCTYPE html>
<html><head>
<title>LeadGen Desk API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/doc', dom_id: '#swagger-ui' })</script>
</body></html>`)
})

app.get('/doc', (c) => {
  // Collect OpenAPI docs from all sub-routers that are OpenAPIHono instances
  // For now, return the static spec metadata
  return c.json({
    openapi: '3.0.0',
    info: {
      title: 'LeadGen Desk API',
      version: '1.0.0',
      description: 'Lead Generation and Outreach Platform API',
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Development server' },
    ],
    security: [{ cookieAuth: [] }],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'leadhunter_token',
        },
      },
    },
    tags: [
      { name: 'Leads', description: 'Lead management operations' },
      { name: 'Stats', description: 'Dashboard statistics and analytics' },
      { name: 'Scraper', description: 'Google Maps scraping operations' },
      { name: 'AI', description: 'AI-powered lead scoring and email drafting' },
      { name: 'Settings', description: 'Application settings management' },
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Analysis', description: 'Lead analysis and enrichment' },
      { name: 'Outreach', description: 'Email outreach and sequences' },
      { name: 'Bulk', description: 'Bulk operations on leads' },
      { name: 'Notes', description: 'Lead notes and activity' },
      { name: 'Scheduler', description: 'Scheduler status and control' },
      { name: 'EmailFinder', description: 'Email finding operations' },
      { name: 'EmailVerifier', description: 'Email verification operations' },
      { name: 'Templates', description: 'Email template management' },
      { name: 'Pipeline', description: 'Pipeline targets and digests' },
      { name: 'QueryProfiles', description: 'Smart query profile management' },
      { name: 'EmailAccounts', description: 'Email account management' },
      { name: 'Users', description: 'User management' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
    paths: {},
  })
})

// ── Health checks ──────────────────────────────────────────────────

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  })
})

app.get('/health/detailed', async (c) => {
  const checks = {
    database: 'unknown' as string,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
  }

  try {
    await getDataSource().query('SELECT 1')
    checks.database = 'healthy'
  } catch {
    checks.database = 'unhealthy'
  }

  const status = checks.database === 'healthy' ? 'healthy' : 'degraded'
  const statusCode = status === 'healthy' ? 200 : 503

  return c.json({ status, ...checks }, statusCode)
})

// ── WebSocket ──────────────────────────────────────────────────────

app.get('/ws', (c) => {
  const ws = (c.env as any).upgrade(c.req.raw)
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
  
  ws.addEventListener('open', () => {
    logger.debug('WebSocket connected')
  })

  ws.addEventListener('message', (event: any) => {
    try {
      const msg = JSON.parse(event.data.toString())
      if (msg.type === 'subscribe') {
        const channels = Array.isArray(msg.channels) ? msg.channels : [msg.channel]
        channels.forEach((ch: string) => wsHub.subscribe(ch, ws))
      } else if (typeof msg.type === 'string' && msg.type.startsWith('worker:')) {
        // Forward directly to workerHub if connected via /ws
        workerHub.handleConnection(ws, ip)
      }
    } catch {
      // ignore malformed
    }
  })

  ws.addEventListener('close', () => {
    wsHub.unsubscribe(ws)
  })

  ws.addEventListener('error', () => {
    wsHub.unsubscribe(ws)
  })

  return ws
})

app.get('/ws/workers', (c) => {
  const ws = (c.env as any).upgrade(c.req.raw)
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
  workerHub.handleConnection(ws, ip)
  return ws
})

// ── Start server ───────────────────────────────────────────────────

const port = parseInt(process.env.PORT || '4000', 10)

async function start() {
  // Initialize Sentry (no-op if SENTRY_DSN not set)
  initSentry()

  // Initialize database
  await initDb()
  logger.info('Database initialized for web server')

  // Initialize plugin registry (must be after DB)
  await initPluginRegistry()
  logger.info('Plugin registry initialized')
  
  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    logger.info({ port: info.port }, `Server started on http://localhost:${info.port}`)
    logger.info(`Health Check: http://localhost:${info.port}/health`)
    logger.info(`Swagger UI:  http://localhost:${info.port}/swagger`)
    logger.info(`OpenAPI Spec: http://localhost:${info.port}/doc`)
  })
}

export { start }

if (process.env.NODE_ENV !== 'test') {
  start().catch((err) => {
    captureException(err)
    logger.fatal({ err }, 'Failed to start server')
    process.exit(1)
  })
}