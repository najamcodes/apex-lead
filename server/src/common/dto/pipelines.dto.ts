import { z } from 'zod';

export const PipelineDagGraphSchema = z.object({
  nodes: z.array(z.record(z.string(), z.unknown())).min(0),
  edges: z.array(z.record(z.string(), z.unknown())).min(0),
});

export const ExecuteDagPipelineSchema = z.object({
  graph: PipelineDagGraphSchema,
  initialRecords: z.array(z.record(z.string(), z.unknown())).optional().default([]),
});

export const ValidateDagPipelineSchema = z.object({
  graph: PipelineDagGraphSchema,
});

export type ExecuteDagPipelineDto = z.infer<typeof ExecuteDagPipelineSchema>;
export type ValidateDagPipelineDto = z.infer<typeof ValidateDagPipelineSchema>;
