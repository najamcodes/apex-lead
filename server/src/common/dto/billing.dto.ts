import { z } from 'zod';

export const CheckoutSchema = z.object({
  tier: z.enum(['starter', 'pro', 'agency', 'enterprise']).default('pro'),
  interval: z.enum(['monthly', 'yearly']).default('monthly'),
});

export type CheckoutDto = z.infer<typeof CheckoutSchema>;
