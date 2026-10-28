import './polyfill'
import { Application, Controller } from 'katal'
import { verifyToken } from './src/auth'
import { wsHub } from './src/ws'
import { initDb, getDataSource } from './src/db'
import { UserEntity } from './src/db/entities/UserEntity'
import { initSentry, captureException, setUserContext } from './src/utils/sentry'
import { logger } from './src/utils/logger'
import { logRequest } from './src/middleware/logger'
import { rateLimiter } from './src/middleware/rateLimiter'
import { getCookie } from './src/utils/cookies'
import { initPluginRegistry } from '@sdk/core/plugins'

import { registerAllRoutes } from './src/controllers'
import { workerHub } from './src/ws/worker-hub'

import { runWithUser, type RequestUser } from './src/context'
import { UserOrganizationEntity } from './src/db/entities/UserOrganizationEntity'
import { katalApp } from './src/app'

declare global {
  var currentUserId: number | undefined;
  var currentOrgId: number | undefined;
  var currentUserRole: string | undefined;
  var currentUserPermissions: string[] | undefined;
}

// Attach app.request helper for testing & programmatic execution
export interface KatalAppWithRequest extends Application {
  request: (input: string | Request | URL, init?: RequestInit) => Promise<Response>;
}

export const app = katalApp as KatalAppWithRequest;

if (!app.request) {
  app.request = function (input: string | Request | URL, init?: RequestInit): Promise<Response> {
    let req: Request;
    if (input instanceof Request) {
      req = init ? new Request(input, init) : input;
    } else {
      const url = typeof input === 'string' && input.startsWith('/')
        ? `http://localhost${input}`
        : String(input);
      req = new Request(url, init);
    }
    return this.fetch(req);
  };
}

// Ensure ctx.req is always available for legacy / custom middlewares
app.use(async (ctx: any, next: () => Promise<any>) => {
  if (!ctx.req) {
    ctx.req = {
      raw: ctx.request,
      url: ctx.request?.url || '',
      method: ctx.request?.method || 'GET',
      path: ctx.request?.url ? new URL(ctx.request.url).pathname : '/',
      header: (name: string) => ctx.request?.headers?.get?.(name) ?? undefined,
      param: (name?: string) => name ? ctx.params?.[name] : (ctx.params || {}),
      query: (name?: string) => name ? ctx.query?.[name] : (ctx.query || {}),
      json: async () => typeof ctx.json === 'function' ? await ctx.json() : (ctx.body ?? {}),
    };
  }
  return await next();
});

// ── LeadGen CORS Middleware ──────────────────────────────────────────
const allowedHeaders = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'X-Desktop-App',
  'X-User-Id',
  'X-Org-Id',
  'X-Current-Role',
  'Accept',
  'Origin',
].join(', ');
const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'].join(', ');

app.use(async (ctx: any, next: () => Promise<any>) => {
  const origin = ctx.request.headers.get('origin');
  const isOptions = ctx.request.method === 'OPTIONS';

  let resolvedOrigin: string | null = null;
  if (!origin) {
    resolvedOrigin = '*';
  } else if (origin === 'null') {
    resolvedOrigin = 'null';
  } else if (
    ctx.request.headers.get('x-desktop-app') === 'true' ||
    ctx.request.headers.get('access-control-request-headers')?.toLowerCase().includes('x-desktop-app') ||
    process.env.NODE_ENV === 'desktop'
  ) {
    resolvedOrigin = origin || '*';
  } else if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    resolvedOrigin = origin;
  } else if (
    origin.startsWith('vscode-webview://') ||
    origin.startsWith('file://') ||
    origin.startsWith('app://') ||
    origin.startsWith('electron://') ||
    origin.startsWith('devtools://')
  ) {
    resolvedOrigin = origin;
  } else {
    const envOrigins = process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || [];
    if (envOrigins.includes(origin)) resolvedOrigin = origin;
  }

  if (isOptions) {
    const headers = new Headers();
    if (resolvedOrigin) {
      headers.set('Access-Control-Allow-Origin', resolvedOrigin);
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
    headers.set('Access-Control-Allow-Methods', allowedMethods);
    headers.set('Access-Control-Allow-Headers', allowedHeaders);
    headers.set('Access-Control-Max-Age', '86400');
    return new Response(null, { status: 204, headers });
  }

  const response = await next();
  if (resolvedOrigin && response instanceof Response) {
    response.headers.set('Access-Control-Allow-Origin', resolvedOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return response;
});

// ── Structured logging (Pino) ───────────────────────────────────────
app.use(logRequest());

// ── Rate limiting ───────────────────────────────────────────────────
const globalLimiter = rateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  keyGenerator: (c: any) => {
    const ip = c.req?.header?.('x-forwarded-for') || c.req?.header?.('x-real-ip') || 'unknown';
    return `ip:${ip}`;
  },
});

const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyGenerator: (c: any) => {
    const ip = c.req?.header?.('x-forwarded-for') || c.req?.header?.('x-real-ip') || 'unknown';
    return `auth:${ip}`;
  },
});

app.use(async (ctx: any, next: () => Promise<any>) => {
  const pathname = new URL(ctx.request.url).pathname;
  if (pathname.startsWith('/api/auth/')) {
    return authLimiter(ctx, next);
  }
  if (pathname.startsWith('/api/')) {
    return globalLimiter(ctx, next);
  }
  return next();
});

// ── Auth middleware ─────────────────────────────────────────────────
app.use(async (ctx: any, next: () => Promise<any>) => {
  const pathname = new URL(ctx.request.url).pathname;
  if (!pathname.startsWith('/api')) {
    return next();
  }

  // Exempt auth registration & login routes
  if (
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/register') ||
    pathname.startsWith('/api/v1/auth/login') ||
    pathname.startsWith('/api/v1/auth/register')
  ) {
    return next();
  }

  // 1. Try cookie
  let token = getCookie(ctx, 'leadhunter_token');

  // 2. Try Authorization: Bearer <token>
  if (!token) {
    const authHeader = ctx.request.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  let resolvedUserId: number | null = null;
  let resolvedOrgId: number | null = null;

  if (token) {
    const payload = verifyToken(token) as any;
    if (payload && payload.id) {
      resolvedUserId = Number(payload.id);
      if (payload.org_id) resolvedOrgId = Number(payload.org_id);
    }
  }

  // 3. Desktop / Local mode fallback:
  const isDesktopMode =
    process.env.NODE_ENV === 'desktop' ||
    ctx.request.headers.get('x-desktop-app') === 'true';

  if (!resolvedUserId && isDesktopMode) {
    const headerUserId = ctx.request.headers.get('x-user-id');
    if (headerUserId) {
      const parsed = parseInt(headerUserId, 10);
      if (!isNaN(parsed)) resolvedUserId = parsed;
    }
    const headerOrgId = ctx.request.headers.get('x-org-id');
    if (headerOrgId) {
      const parsedOrg = parseInt(headerOrgId, 10);
      if (!isNaN(parsedOrg)) resolvedOrgId = parsedOrg;
    }

    if (!resolvedUserId) {
      resolvedUserId = global.currentUserId || 1;
    }
  }

  if (!resolvedUserId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userRepo = getDataSource().getRepository(UserEntity);
  let user = await userRepo.findOneBy({ id: resolvedUserId });

  if (!user && isDesktopMode) {
    user = await userRepo.findOne({ where: {}, order: { id: 'ASC' } });
  }

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const activeOrgId: number = resolvedOrgId ?? user.default_org_id ?? 1;

  let orgRole = user.role;
  let orgPermissions: string[] = JSON.parse(user.permissions || '[]');
  if (user.role !== 'super_admin') {
    try {
      const userOrgRepo = getDataSource().getRepository(UserOrganizationEntity);
      const link = await userOrgRepo.findOne({ where: { user_id: user.id, org_id: activeOrgId } });
      if (link) {
        orgRole = link.role;
        orgPermissions = JSON.parse(link.permissions || '[]');
      }
    } catch {
      // fallback
    }
  }

  const requestUser: RequestUser = {
    id: user.id,
    org_id: activeOrgId,
    role: orgRole,
    permissions: orgPermissions,
    name: user.name,
    email: user.email,
  };

  setUserContext({ id: String(user.id), email: user.email, role: orgRole });

  ctx.user = requestUser;
  ctx.state = ctx.state || {};
  ctx.state.user = requestUser;

  global.currentUserId = user.id;
  global.currentOrgId = activeOrgId;
  global.currentUserRole = orgRole;
  global.currentUserPermissions = orgPermissions;

  return await runWithUser(requestUser, async () => {
    return await next();
  });
});

// ── Domain Routes ───────────────────────────────────────────────────
registerAllRoutes(app);

class DetailedHealthController extends Controller {
  async handle() {
    const checks = {
      database: 'unknown' as string,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    };

    try {
      await getDataSource().query('SELECT 1');
      checks.database = 'healthy';
    } catch {
      checks.database = 'unhealthy';
    }

    const status = checks.database === 'healthy' ? 'healthy' : 'degraded';
    const statusCode = status === 'healthy' ? 200 : 503;

    return this.json({ status, ...checks }, statusCode);
  }
}

app.get('/health/detailed', DetailedHealthController);

// ── Start server ───────────────────────────────────────────────────
const port = parseInt(process.env.PORT || '4000', 10);

async function start() {
  initSentry();
  await initDb();
  logger.info('Database initialized for web server');
  await initPluginRegistry();
  logger.info('Plugin registry initialized');

  if (typeof Bun !== 'undefined') {
    Bun.serve({
      port,
      fetch(req, server) {
        const url = new URL(req.url);
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

        if (url.pathname === '/ws') {
          const upgraded = (server as any).upgrade(req, { data: { type: 'client', ip } });
          if (upgraded) return undefined;
        }

        if (url.pathname === '/ws/workers') {
          const upgraded = (server as any).upgrade(req, { data: { type: 'worker', ip } });
          if (upgraded) return undefined;
        }

        return app.fetch(req);
      },
      websocket: {
        open(ws: any) {
          if (ws.data?.type === 'worker') {
            workerHub.handleConnection(ws, ws.data?.ip);
          } else {
            logger.debug('WebSocket connected');
          }
        },
        message(ws: any, message: any) {
          try {
            const msg = JSON.parse(message.toString());
            if (msg.type === 'subscribe') {
              const channels = Array.isArray(msg.channels) ? msg.channels : [msg.channel];
              channels.forEach((ch: string) => wsHub.subscribe(ch, ws));
            } else if (typeof msg.type === 'string' && msg.type.startsWith('worker:')) {
              workerHub.handleConnection(ws, ws.data?.ip);
            }
          } catch {
            // ignore malformed
          }
        },
        close(ws: any) {
          wsHub.unsubscribe(ws);
        },
      },
    });

    logger.info({ port }, `Katal Server started on http://localhost:${port}`);
    logger.info(`Health Check: http://localhost:${port}/health`);
  } else {
    await app.listen(port);
  }
}

export { start };

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.env.BUN_ENV === 'test' ||
  typeof (globalThis as any).describe !== 'undefined';

if (!isTestEnv) {
  start().catch((err) => {
    captureException(err);
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  });
}