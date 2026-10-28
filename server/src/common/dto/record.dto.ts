import { z } from 'zod';

export const identitySchema = z.object({
  type: z.enum(['domain', 'email', 'phone', 'maps_place_id', 'linkedin', 'external_id']),
  value: z.string().min(1, 'Identity value cannot be empty').max(255),
});

export const upsertRecordSchema = z.object({
  collectionType: z.string().max(64).default('leads'),
  title: z.string().min(1, 'Title is required').max(255),
  status: z.string().max(64).default('new'),
  source: z.string().max(64).default('manual'),
  enrichmentScore: z.number().int().min(0).max(100).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
  identities: z.array(identitySchema).default([]),
});

export const listRecordsQuerySchema = z.object({
  collectionType: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  withIdentities: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});

export const recordIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Record ID must be a positive integer'),
});

export type UpsertRecordDto = z.infer<typeof upsertRecordSchema>;
export type ListRecordsQueryDto = z.infer<typeof listRecordsQuerySchema>;
export type RecordIdParamDto = z.infer<typeof recordIdParamSchema>;
