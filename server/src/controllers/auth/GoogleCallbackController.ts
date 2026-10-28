import { Controller, type RequestContext } from 'katal';
import { AuthService } from '../../services/AuthService';
import { GoogleAuthService } from '../../services/GoogleAuthService';
import { extractCookie } from './helpers';

export class GoogleCallbackController extends Controller {
  static __paramTokens = [AuthService, GoogleAuthService];

  constructor(
    private authService: AuthService,
    private googleAuthService: GoogleAuthService
  ) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      const url = new URL(context.request.url);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const cookieHeader = context.request?.headers?.get('cookie') || null;
      const storedState = extractCookie(cookieHeader, 'oauth_state');

      if (!code) {
        return this.badRequest('Missing authorization code');
      }
      if (state && storedState && state !== storedState) {
        return this.badRequest('Invalid OAuth state parameter');
      }

      const profile = await this.googleAuthService.exchangeCodeForProfile(code);
      const result = await this.authService.loginOrRegisterGoogleUser(profile);

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

      return this.badRequest(message || 'Google authentication failed');
    }
  }
}
