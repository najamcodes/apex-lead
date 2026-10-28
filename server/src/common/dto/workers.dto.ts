import { z } from 'zod';

export const RegisterEdgeWorkerSchema = z.object({
  workerId: z.string().min(1, 'workerId is required'),
  cpuCores: z.number().int().positive().default(4),
  availableMemoryMb: z.number().int().positive().default(4096),
  clientVersion: z.string().default('1.0.0'),
});

export const WorkerIdSchema = z.object({
  workerId: z.string().min(1, 'workerId is required'),
});

export const WorkerChunkResultSchema = z.object({
  workerId: z.string().min(1, 'workerId is required'),
  jobId: z.string().min(1, 'jobId is required'),
  chunkId: z.string().min(1, 'chunkId is required'),
  success: z.boolean().default(true),
  recordsDiscovered: z.array(z.record(z.string(), z.unknown())).default([]),
  error: z.string().optional(),
});

export type RegisterEdgeWorkerDto = z.infer<typeof RegisterEdgeWorkerSchema>;
export type WorkerIdDto = z.infer<typeof WorkerIdSchema>;
export type WorkerChunkResultDto = z.infer<typeof WorkerChunkResultSchema>;
