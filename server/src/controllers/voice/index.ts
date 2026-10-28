import type { Application } from 'katal';
import { CreateVoiceCampaignController } from './CreateVoiceCampaignController';
import { InitiateVoiceCallController } from './InitiateVoiceCallController';
import { VoiceWebhookController } from './VoiceWebhookController';

export * from './CreateVoiceCampaignController';
export * from './InitiateVoiceCallController';
export * from './VoiceWebhookController';

export function registerVoiceRoutes(app: Application) {
  app.post('/api/v1/voice/campaigns', CreateVoiceCampaignController);
  app.post('/api/v1/voice/call', InitiateVoiceCallController);
  app.post('/api/v1/voice/webhook', VoiceWebhookController);
}
