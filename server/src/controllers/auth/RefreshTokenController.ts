import { Controller, type RequestContext } from 'katal';
import { AuthService } from '../../services/AuthService';
import { RefreshTokenSchema } from '../../common';
import { extractCookie } from './helpers';

export class RefreshTokenController extends Controller {
  static __paramTokens = [AuthService];

  constructor(private authService: AuthService) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      let refreshToken: string | null = null;

      try {
        const rawBody = typeof context.json === 'function' ? await context.json() : context.body;
        const parsed = RefreshTokenSchema.safeParse(rawBody);
        if (parsed.success && parsed.data.refreshToken) {
          refreshToken = parsed.data.refreshToken;
        }
      } catch {}

      if (!refreshToken) {
        const cookieHeader = context.request?.headers?.get('cookie') || null;
        refreshToken = extractCookie(cookieHeader, 'apex_refresh_token');
      }

      if (!refreshToken) {
        return this.unauthorized('No refresh token provided');
      }

      const result = await this.authService.refreshSession(refreshToken);

      return new Response(JSON.stringify({
        success: true,
        token: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `apex_refresh_token=${result.refreshToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.unauthorized(message || 'Invalid refresh token');
    }
  }
}
