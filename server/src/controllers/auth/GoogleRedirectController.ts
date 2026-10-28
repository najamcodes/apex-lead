import { Controller, type RequestContext } from 'katal';
import { GoogleAuthService } from '../../services/GoogleAuthService';

export class GoogleRedirectController extends Controller {
  static __paramTokens = [GoogleAuthService];

  constructor(private googleAuthService: GoogleAuthService) {
    super();
  }

  async handle(context: RequestContext) {
    const state = crypto.randomUUID();
    const url = this.googleAuthService.getAuthorizationUrl(state);

    return new Response(JSON.stringify({ url, state }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `oauth_state=${state}; HttpOnly; Path=/; SameSite=Lax; Max-Age=600`,
      },
    });
  }
}
