import { z } from 'zod';

export const TrackVisitorSchema = z.object({
  siteKey: z.string().min(1, 'siteKey is required'),
  sessionId: z.string().min(1, 'sessionId is required'),
  path: z.string().min(1, 'path is required'),
  referrer: z.string().optional().default(''),
  durationSeconds: z.coerce.number().min(0).default(0),
});

export const RegisterSiteSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
  slackWebhookUrl: z.string().url('Invalid Slack webhook URL').optional().or(z.literal('')),
});

export type TrackVisitorDto = z.infer<typeof TrackVisitorSchema>;
export type RegisterSiteDto = z.infer<typeof RegisterSiteSchema>;
