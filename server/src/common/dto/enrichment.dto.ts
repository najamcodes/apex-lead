import { z } from 'zod';

export const WaterfallEnrichmentSchema = z.object({
  firstName: z.string().min(1, 'firstName is required for waterfall enrichment'),
  lastName: z.string().optional().default(''),
  domain: z.string().min(1, 'domain is required for waterfall enrichment'),
  companyName: z.string().optional(),
  phone: z.string().optional(),
});

export type WaterfallEnrichmentDto = z.infer<typeof WaterfallEnrichmentSchema>;
