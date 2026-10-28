import { Controller } from 'katal';

export class HealthController extends Controller {
  async handle() {
    return this.json({
      status: 'healthy',
      framework: 'katal@3.0.0',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  }
}
