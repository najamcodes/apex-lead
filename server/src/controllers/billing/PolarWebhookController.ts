import { Controller, type RequestContext } from 'katal';
import { PolarBillingService, type PolarWebhookData } from '../../services/PolarBillingService';

interface PolarWebhookPayload {
  type?: string;
  event?: string;
  data?: PolarWebhookData;
}

export class PolarWebhookController extends Controller {
  static __paramTokens = [PolarBillingService];

  constructor(private billingService: PolarBillingService) {
    super();
  }

  async handle(context: RequestContext) {
    try {
      const rawBody = typeof context.request.text === 'function'
        ? await context.request.text()
        : JSON.stringify(context.body || {});

      const signature = context.request.headers.get('webhook-signature')
        || context.request.headers.get('polar-signature')
        || context.request.headers.get('x-polar-signature');

      const isValid = this.billingService.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        return this.unauthorized('Invalid webhook signature');
      }

      let payload: PolarWebhookPayload = {};
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return this.badRequest('Malformed JSON body');
      }

      const eventType = payload.type || payload.event;

      switch (eventType) {
        case 'subscription.created':
        case 'subscription.updated':
        case 'subscription.active':
          if (payload.data) {
            await this.billingService.handleSubscriptionChange(payload.data, 'active');
          }
          break;

        case 'subscription.canceled':
        case 'subscription.revoked':
          if (payload.data) {
            await this.billingService.handleSubscriptionChange(payload.data, 'canceled');
          }
          break;

        case 'order.created':
          if (payload.data) {
            await this.billingService.handleOrderCreated(payload.data);
          }
          break;

        default:
          break;
      }

      return this.json({ received: true, event: eventType }, 200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      return this.badRequest(message || 'Webhook processing failed');
    }
  }
}
