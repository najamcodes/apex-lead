import { z } from 'zod';

export const CreateVoiceCampaignSchema = z.object({
  name: z.string().min(1, 'name is required'),
  voiceProvider: z.string().default('vapi'),
  assistantId: z.string().default('asst_default'),
  systemPromptTemplate: z.string().min(1, 'systemPromptTemplate is required'),
  firstSentenceTemplate: z.string().min(1, 'firstSentenceTemplate is required'),
  phoneNumberId: z.string().default('pn_default'),
});

export const InitiateVoiceCallSchema = z.object({
  campaignId: z.string().min(1, 'campaignId is required'),
  recordId: z.string().min(1, 'recordId is required'),
  recipientPhone: z.string().min(1, 'recipientPhone is required'),
  recordData: z.record(z.string(), z.unknown()).optional().default({}),
});

export const VoiceWebhookSchema = z.object({
  callSid: z.string().min(1, 'callSid is required'),
  durationSeconds: z.coerce.number().min(0).default(60),
  transcript: z.string().optional().default(''),
  summary: z.string().optional(),
  sentimentScore: z.coerce.number().optional(),
  appointmentBooked: z.boolean().optional(),
  appointmentTime: z.string().optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
});

export type CreateVoiceCampaignDto = z.infer<typeof CreateVoiceCampaignSchema>;
export type InitiateVoiceCallDto = z.infer<typeof InitiateVoiceCallSchema>;
export type VoiceWebhookDto = z.infer<typeof VoiceWebhookSchema>;
