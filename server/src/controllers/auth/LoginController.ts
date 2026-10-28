import { Controller, type RequestContext } from 'katal';
import { AuthService } from '../../services/AuthService';
import { LoginSchema } from '../../common';

export class LoginController extends Controller {
  static __paramTokens = [AuthService];

  constructor(private authService: AuthService) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = LoginSchema.parse(rawBody);

      const result = await this.authService.loginWithPassword(
        validated.email,
        validated.password
      );

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
      const zodErr = err as { name?: string; errors?: Array<{ message?: string }> };
      if (zodErr.name === 'ZodError') {
        return this.badRequest(zodErr.errors?.[0]?.message || 'Validation error');
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.unauthorized(message || 'Invalid credentials');
    }
  }
}
