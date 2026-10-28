import { z } from 'zod';

export const CreateCadenceSchema = z.object({
  name: z.string().min(1, 'Cadence name is required'),
  dailyLimit: z.number().int().positive().optional().default(50),
});

export const AddCadenceStepSchema = z.object({
  stepNumber: z.number().int().min(1).default(1),
  delayDays: z.number().int().min(0).default(1),
  subjectTemplate: z.string().min(1, 'subjectTemplate is required'),
  bodyTemplate: z.string().min(1, 'bodyTemplate is required'),
});

export const EnrollCadenceRecordSchema = z.object({
  recordId: z.string().min(1, 'recordId is required'),
  recipientEmail: z.string().email('Invalid recipientEmail address'),
});

export const ReplyWebhookSchema = z.object({
  fromEmail: z.string().email('Valid fromEmail is required'),
  subject: z.string().default(''),
  bodySnippet: z.string().optional(),
});

export type CreateCadenceDto = z.infer<typeof CreateCadenceSchema>;
export type AddCadenceStepDto = z.infer<typeof AddCadenceStepSchema>;
export type EnrollCadenceRecordDto = z.infer<typeof EnrollCadenceRecordSchema>;
export type ReplyWebhookDto = z.infer<typeof ReplyWebhookSchema>;
