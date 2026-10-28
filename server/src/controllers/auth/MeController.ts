import { Controller, type RequestContext } from 'katal';
import { AuthService } from '../../services/AuthService';

export class MeController extends Controller {
  static __paramTokens = [AuthService];

  constructor(private authService: AuthService) {
    super();
  }

  async handle(context: RequestContext) {
    const userId = Number(context.user?.id || (context.state as Record<string, unknown>)?.userId);
    if (!userId) {
      return this.unauthorized('Authentication required');
    }

    try {
      const profile = await this.authService.getUserProfile(userId);
      return this.success({ user: profile });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.notFound(message || 'User not found');
    }
  }
}
