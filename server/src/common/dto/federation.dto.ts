import { z } from 'zod';

export const FederationSearchSchema = z.object({
  query: z.string().min(1, 'query is required for federated search'),
  location: z.string().min(1, 'location is required for federated search'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type FederationSearchDto = z.infer<typeof FederationSearchSchema>;
