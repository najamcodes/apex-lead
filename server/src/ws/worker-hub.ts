// server/src/ws/worker-hub.ts
// WebSocket hub and dispatch manager for child desktop worker farm nodes.

import type { WebSocket } from 'ws'
import { getDataSource } from '@sdk/backend/db'
import { WorkerNodeEntity } from '@sdk/backend/db/entities/WorkerNodeEntity'
import { PipelineRunEntity } from '@sdk/backend/db/entities/PipelineRunEntity'
import { storeRecord } from '@sdk/backend/collections/store'
import { wsHub } from './index'
import type { ConnectedWorker } from '@sdk/core/worker'

export type { ConnectedWorker }

// In-memory registry of live connected worker sockets
const activeWorkers = new Map<string, ConnectedWorker>()

export const workerHub = {
  /** Register a newly connected worker socket */
  handleConnection(ws: any, ipAddress?: string) {
    let currentWorkerId: string | null = null

    const onMessage = async (raw: any) => {
      try {
        const text = typeof raw === 'string' ? raw : (raw?.data ? raw.data.toString() : raw.toString())
        const msg = JSON.parse(text)
        const { type, data } = msg

        switch (type) {
          case 'worker:register': {
            const { workerId, orgId, userId, name, capabilities, platform, maxConcurrency, version } = data
            currentWorkerId = workerId

            const workerRecord: ConnectedWorker = {
              ws,
              workerId,
              orgId: Number(orgId),
              userId: userId ? Number(userId) : undefined,
              name: name || 'Desktop Worker',
              capabilities: Array.isArray(capabilities) ? capabilities : ['google_maps', 'pipeline_executor'],
              platform: platform || 'unknown',
              maxConcurrency: Number(maxConcurrency) || 2,
              activeJobs: 0,
              ipAddress,
              lastSeen: Date.now(),
            }
            activeWorkers.set(workerId, workerRecord)

            // Persist or update in database
            await persistWorkerState(workerRecord, 'idle', version)
            console.log(`[WorkerHub] Registered worker node: ${name} (${workerId}) for org ${orgId}`)

            ws.send(JSON.stringify({
              type: 'worker:registered',
              data: { success: true, workerId, serverTime: new Date().toISOString() },
            }))

            // Broadcast farm update to org clients
            wsHub.broadcast(`org:${orgId}:workers`, { event: 'worker_connected', workerId, name })
            break
          }

          case 'worker:heartbeat': {
            if (!currentWorkerId) return
            const worker = activeWorkers.get(currentWorkerId)
            if (worker) {
              worker.lastSeen = Date.now()
              if (data?.activeJobs !== undefined) {
                worker.activeJobs = Number(data.activeJobs)
              }
              const status = worker.activeJobs >= worker.maxConcurrency ? 'busy' : 'idle'
              await updateWorkerHeartbeat(worker.workerId, worker.activeJobs, status)
            }
            ws.send(JSON.stringify({ type: 'worker:heartbeat_ack', data: { time: Date.now() } }))
            break
          }

          case 'worker:progress': {
            const { runId, nodeId, message, stats, logEntry } = data
            if (runId) {
              // Update run in DB
              const runRepo = getDataSource().getRepository(PipelineRunEntity)
              if (stats) {
                await runRepo.update(runId, { stats: JSON.stringify(stats) }).catch(() => {})
              }
              // Broadcast progress to web UI subscribers
              wsHub.broadcast(`pipeline:${runId}:progress`, { runId, nodeId, message, stats, logEntry })
            }
            break
          }

          case 'worker:record': {
            // Ingest scraped record into central database
            const { orgId, collection, record, source } = data
            if (orgId && record) {
              await storeRecord({
                collection: collection || 'leads',
                orgId: Number(orgId),
                data: record,
                mode: 'upsert',
                source: source || `worker:${currentWorkerId}`,
              }).catch(err => {
                console.error('[WorkerHub] Failed to store worker record:', err)
              })
            }
            break
          }

          case 'worker:completed': {
            const { runId, stats, log } = data
            if (runId) {
              const runRepo = getDataSource().getRepository(PipelineRunEntity)
              await runRepo.update(runId, {
                status: 'completed',
                completed_at: new Date().toISOString(),
                stats: stats ? JSON.stringify(stats) : undefined,
                log: log ? JSON.stringify(log.slice(-200)) : undefined,
              }).catch(() => {})

              wsHub.broadcast(`pipeline:${runId}:progress`, { runId, status: 'completed', stats })
              console.log(`[WorkerHub] Pipeline run ${runId} completed by worker ${currentWorkerId}`)
            }
            break
          }

          case 'worker:failed': {
            const { runId, error, stats, log } = data
            if (runId) {
              const runRepo = getDataSource().getRepository(PipelineRunEntity)
              await runRepo.update(runId, {
                status: 'failed',
                completed_at: new Date().toISOString(),
                error: String(error || 'Worker execution failed'),
                stats: stats ? JSON.stringify(stats) : undefined,
                log: log ? JSON.stringify(log.slice(-200)) : undefined,
              }).catch(() => {})

              wsHub.broadcast(`pipeline:${runId}:progress`, { runId, status: 'failed', error })
              console.error(`[WorkerHub] Pipeline run ${runId} failed on worker ${currentWorkerId}:`, error)
            }
            break
          }
        }
      } catch (err) {
        console.error('[WorkerHub] Error processing message from worker:', err)
      }
    }

    const onClose = async () => {
      if (currentWorkerId) {
        const worker = activeWorkers.get(currentWorkerId)
        if (worker) {
          activeWorkers.delete(currentWorkerId)
          await markWorkerOffline(currentWorkerId)
          console.log(`[WorkerHub] Worker disconnected: ${worker.name} (${currentWorkerId})`)
          wsHub.broadcast(`org:${worker.orgId}:workers`, { event: 'worker_disconnected', workerId: currentWorkerId })
        }
      }
    }

    const onError = (err: any) => {
      console.warn(`[WorkerHub] Worker connection error (${currentWorkerId}):`, err?.message || err)
    }

    if (typeof ws.on === 'function') {
      ws.on('message', onMessage)
      ws.on('close', onClose)
      ws.on('error', onError)
    } else if (typeof ws.addEventListener === 'function') {
      ws.addEventListener('message', onMessage)
      ws.addEventListener('close', onClose)
      ws.addEventListener('error', onError)
    }
  },

  /** Get all live in-memory connected workers for an organization */
  getLiveWorkers(orgId: number): ConnectedWorker[] {
    const list: ConnectedWorker[] = []
    for (const w of activeWorkers.values()) {
      if (w.orgId === orgId) list.push(w)
    }
    return list
  },

  /** Dispatch a pipeline execution to an available desktop worker in the org */
  async dispatchPipeline(
    orgId: number,
    payload: {
      runId: string
      pipeline: any
      input: Record<string, unknown>
      targetWorkerId?: string
      proxyConfig?: any
    }
  ): Promise<{ dispatched: boolean; workerId?: string; workerName?: string; error?: string }> {
    const orgWorkers = this.getLiveWorkers(orgId)

    if (orgWorkers.length === 0) {
      return { dispatched: false, error: 'No active desktop worker nodes online for this organization.' }
    }

    let selected: ConnectedWorker | undefined

    if (payload.targetWorkerId && payload.targetWorkerId !== 'farm_auto') {
      selected = orgWorkers.find(w => w.workerId === payload.targetWorkerId)
      if (!selected) {
        return { dispatched: false, error: `Target worker '${payload.targetWorkerId}' is currently offline.` }
      }
    } else {
      // Find least loaded worker with capacity
      const available = orgWorkers.filter(w => w.activeJobs < w.maxConcurrency)
      if (available.length > 0) {
        available.sort((a, b) => a.activeJobs - b.activeJobs)
        selected = available[0]
      } else {
        // Fallback to least loaded even if busy
        orgWorkers.sort((a, b) => a.activeJobs - b.activeJobs)
        selected = orgWorkers[0]
      }
    }

    if (!selected || selected.ws.readyState !== 1) { // 1 = OPEN
      return { dispatched: false, error: 'Selected worker is unavailable.' }
    }

    selected.activeJobs += 1
    selected.ws.send(JSON.stringify({
      type: 'dispatch:pipeline',
      data: {
        runId: payload.runId,
        pipeline: payload.pipeline,
        input: payload.input,
        orgId,
        proxyConfig: payload.proxyConfig || null,
      },
    }))

    await updateWorkerHeartbeat(selected.workerId, selected.activeJobs, selected.activeJobs >= selected.maxConcurrency ? 'busy' : 'idle')

    return {
      dispatched: true,
      workerId: selected.workerId,
      workerName: selected.name,
    }
  },
}

// ── Database persistence helpers ─────────────────────────────────

async function persistWorkerState(worker: ConnectedWorker, status: 'online' | 'busy' | 'idle', version?: string) {
  try {
    const repo = getDataSource().getRepository(WorkerNodeEntity)
    const existing = await repo.findOneBy({ id: worker.workerId })
    const now = new Date().toISOString()

    if (existing) {
      existing.org_id = worker.orgId
      existing.user_id = worker.userId ?? existing.user_id
      existing.name = worker.name
      existing.platform = worker.platform
      existing.status = status
      existing.capabilities = JSON.stringify(worker.capabilities)
      existing.max_concurrency = worker.maxConcurrency
      existing.active_jobs = worker.activeJobs
      existing.ip_address = worker.ipAddress ?? existing.ip_address
      existing.version = version ?? existing.version
      existing.last_heartbeat_at = now
      await repo.save(existing)
    } else {
      const entity = repo.create({
        id: worker.workerId,
        org_id: worker.orgId,
        user_id: worker.userId ?? null,
        name: worker.name,
        hostname: null,
        platform: worker.platform,
        status,
        capabilities: JSON.stringify(worker.capabilities),
        max_concurrency: worker.maxConcurrency,
        active_jobs: worker.activeJobs,
        ip_address: worker.ipAddress ?? null,
        version: version ?? '1.0.0',
        last_heartbeat_at: now,
      })
      await repo.save(entity)
    }
  } catch (err) {
    console.error('[WorkerHub] Failed to persist worker state:', err)
  }
}

async function updateWorkerHeartbeat(workerId: string, activeJobs: number, status: 'online' | 'busy' | 'idle') {
  try {
    const repo = getDataSource().getRepository(WorkerNodeEntity)
    await repo.update(workerId, {
      active_jobs: activeJobs,
      status,
      last_heartbeat_at: new Date().toISOString(),
    })
  } catch {}
}

async function markWorkerOffline(workerId: string) {
  try {
    const repo = getDataSource().getRepository(WorkerNodeEntity)
    await repo.update(workerId, {
      status: 'offline',
      active_jobs: 0,
      last_heartbeat_at: new Date().toISOString(),
    })
  } catch {}
}

// Background cleanup: mark workers offline if no heartbeat received in 60s
setInterval(async () => {
  const threshold = Date.now() - 60_000
  for (const [id, w] of activeWorkers.entries()) {
    if (w.lastSeen < threshold) {
      activeWorkers.delete(id)
      await markWorkerOffline(id)
    }
  }
}, 30_000)
