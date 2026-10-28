import { z } from 'zod';

export const CreateMailboxSchema = z.object({
  email: z.string().email('Invalid mailbox email address'),
  fromName: z.string().optional(),
  smtpHost: z.string().min(1, 'smtpHost is required'),
  smtpPort: z.coerce.number().int().positive().default(587),
  smtpUsername: z.string().min(1, 'smtpUsername is required'),
  smtpPassword: z.string().min(1, 'smtpPassword is required'),
});

export const MailboxIdParamSchema = z.object({
  id: z.string().min(1, 'Mailbox ID is required'),
});

export type CreateMailboxDto = z.infer<typeof CreateMailboxSchema>;
export type MailboxIdParamDto = z.infer<typeof MailboxIdParamSchema>;
