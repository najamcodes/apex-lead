import { OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { wsHub } from '../ws'
import {
  startNightlyRunner,
  stopNightlyRunner,
  restartNightlyRunner,
  sendMorningDigest,
  getNightlyRunnerStatus,
} from '../../../electron/pipeline/nightly-runner'
import {
  getAllTargets,
  insertTarget,
  updateTarget,
  toggleTarget,
  deleteTarget
} from '../../../backend/db/queries/targets.queries'
import { getAllDigests } from '../../../backend/db/queries/digests.queries'
import { getPipelineStatus, runNightlyPipeline } from '../../../electron/pipeline'
import {
  IdParamSchema,
  PipelineTargetInsertSchema,
  PipelineTargetUpdateSchema,
} from '../validation/schemas'

export const pipelineRouter = new OpenAPIHono()

// ── Targets CRUD ───────────────────────────────────────────────────

pipelineRouter.openapi({
  method: 'get',
  path: '/targets',
  summary: 'Get all pipeline targets',
  tags: ['Pipeline'],
  responses: {
    200: { description: 'List of targets', content: { 'application/json': { schema: z.array(z.any()) } } },
  },
}, async (c) => {
  const targets = await getAllTargets()
  return c.json(targets)
})

pipelineRouter.openapi({
  method: 'post',
  path: '/targets',
  summary: 'Create pipeline target',
  tags: ['Pipeline'],
  request: {
    body: { content: { 'application/json': { schema: PipelineTargetInsertSchema } } },
  },
  responses: {
    201: { description: 'Target created', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Invalid request body' },
  },
}, async (c) => {
  const data = c.req.valid('json')
  const target = await insertTarget(data as any)
  return c.json(target, 201)
})

pipelineRouter.openapi({
  method: 'put',
  path: '/targets/:id',
  summary: 'Update pipeline target',
  tags: ['Pipeline'],
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: PipelineTargetUpdateSchema } } },
  },
  responses: {
    200: { description: 'Target updated' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  const patch = c.req.valid('json')
  await updateTarget(id, patch as any)
  return c.json({ success: true })
})

pipelineRouter.openapi({
  method: 'patch',
  path: '/targets/:id/toggle',
  summary: 'Toggle pipeline target active/paused',
  tags: ['Pipeline'],
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'Target toggled' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  await toggleTarget(id)
  return c.json({ success: true })
})

pipelineRouter.openapi({
  method: 'delete',
  path: '/targets/:id',
  summary: 'Delete pipeline target',
  tags: ['Pipeline'],
  request: { params: IdParamSchema },
  responses: {
    200: { description: 'Target deleted' },
  },
}, async (c) => {
  const { id } = c.req.valid('param')
  await deleteTarget(id)
  return c.json({ success: true })
})

// ── Digest history ─────────────────────────────────────────────────

pipelineRouter.openapi({
  method: 'get',
  path: '/digests',
  summary: 'Get digest history',
  tags: ['Pipeline'],
  responses: {
    200: { description: 'List of digests', content: { 'application/json': { schema: z.array(z.any()) } } },
  },
}, async (c) => {
  const digests = await getAllDigests()
  return c.json(digests)
})

// ── Pipeline status & control ──────────────────────────────────────

pipelineRouter.openapi({
  method: 'get',
  path: '/status',
  summary: 'Get pipeline status',
  tags: ['Pipeline'],
  responses: {
    200: { description: 'Pipeline status', content: { 'application/json': { schema: z.any() } } },
  },
}, async (c) => {
  const status = getPipelineStatus()
  const runner = await getNightlyRunnerStatus()
  return c.json({ ...status, runner })
})

pipelineRouter.openapi({
  method: 'post',
  path: '/run',
  summary: 'Manually trigger pipeline run',
  tags: ['Pipeline'],
  responses: {
    200: { description: 'Pipeline run result', content: { 'application/json': { schema: z.any() } } },
  },
}, async (c) => {
  const result = await runNightlyPipeline((msg) => {
    wsHub.broadcast('pipeline:log', msg)
  })
  await sendMorningDigest(result)
  return c.json(result)
})

pipelineRouter.openapi({
  method: 'post',
  path: '/digest',
  summary: 'Send morning digest now',
  tags: ['Pipeline'],
  responses: {
    200: { description: 'Digest sent' },
  },
}, async (c) => {
  await sendMorningDigest()
  return c.json({ success: true })
})

pipelineRouter.openapi({
  method: 'post',
  path: '/restart',
  summary: 'Restart nightly runner',
  tags: ['Pipeline'],
  responses: {
    200: { description: 'Runner restarted' },
  },
}, async (c) => {
  restartNightlyRunner()
  return c.json({ success: true })
})
