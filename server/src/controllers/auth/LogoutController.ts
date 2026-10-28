import { Controller, type RequestContext } from 'katal';

export class LogoutController extends Controller {
  async handle(context: RequestContext) {
    return new Response(JSON.stringify({ success: true, message: 'Logged out successfully' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'apex_refresh_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
      },
    });
  }
}
