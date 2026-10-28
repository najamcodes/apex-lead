import { Controller, type RequestContext } from 'katal';
import { AuthService } from '../../services/AuthService';
import { SignupSchema } from '../../common';

export class SignupController extends Controller {
  static __paramTokens = [AuthService];

  constructor(private authService: AuthService) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      const rawBody = typeof context.json === 'function' ? await context.json() : context.body || {};
      const validated = SignupSchema.parse(rawBody);

      const result = await this.authService.signupWithPassword(
        validated.email,
        validated.password,
        validated.name
      );

      return new Response(JSON.stringify({
        success: true,
        token: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      }), {
        status: 201,
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
      return this.badRequest(message || 'Signup failed');
    }
  }
}
