import { describe, it, expect, beforeEach } from 'bun:test'
import { WorkerHubService } from '../../../server/src/services/workers/WorkerHubService'
import {
  WorkerRegisterMessage,
  JobChunk,
  ChunkResultMessage,
} from '../../../server/src/services/workers/protocol/WorkerMessages'

describe('Hybrid Edge Desktop Worker Network (Phase 6)', () => {
  let hub: WorkerHubService
  const orgId = 5001

  beforeEach(() => {
    hub = new WorkerHubService()
  })

  it('should register desktop workers with hardware metrics and idle state', () => {
    const regMsg: WorkerRegisterMessage = {
      type: 'register',
      workerId: 'worker-win11-node1',
      orgId,
      cpuCores: 16,
      availableMemoryMb: 32768,
      clientVersion: '1.2.0',
    }

    const worker = hub.registerWorker(regMsg)
    expect(worker.workerId).toBe('worker-win11-node1')
    expect(worker.orgId).toBe(orgId)
    expect(worker.cpuCores).toBe(16)
    expect(worker.status).toBe('idle')
    expect(worker.lastHeartbeat).toBeDefined()

    const activeList = hub.getConnectedWorkers(orgId)
    expect(activeList.length).toBe(1)
    expect(activeList[0].workerId).toBe('worker-win11-node1')
  })

  it('should mark workers offline when heartbeat exceeds timeout threshold', () => {
    hub.registerWorker({
      type: 'register',
      workerId: 'worker-stale-node',
      orgId,
      cpuCores: 8,
      availableMemoryMb: 16384,
      clientVersion: '1.2.0',
    })

    // Artificially age the heartbeat by 65 seconds
    const workers = hub.getConnectedWorkers(orgId)
    expect(workers.length).toBe(1)
    workers[0].lastHeartbeat = new Date(Date.now() - 65000)

    // Re-querying should identify it as offline
    const updated = hub.getConnectedWorkers(orgId)
    expect(updated[0].status).toBe('offline')

    // Recording a fresh heartbeat brings it back online to 'idle'
    const renewed = hub.recordHeartbeat('worker-stale-node')
    expect(renewed).toBe(true)

    const refreshed = hub.getConnectedWorkers(orgId)
    expect(refreshed[0].status).toBe('idle')
  })

  it('should queue chunks, dispatch to available worker, and set worker status to busy', () => {
    hub.registerWorker({
      type: 'register',
      workerId: 'worker-active-1',
      orgId,
      cpuCores: 12,
      availableMemoryMb: 24000,
      clientVersion: '1.2.0',
    })

    const chunk: JobChunk = {
      jobId: 'job-hvac-dallas',
      chunkId: 'chunk-zip-75001',
      sourcePlugin: 'gmaps',
      params: { query: 'HVAC repair', zipCode: '75001' },
      maxLeads: 25,
      timeoutMs: 60000,
    }

    hub.queueJobChunk(chunk)

    // Dispatch to worker-active-1
    const dispatched = hub.dispatchNextChunk('worker-active-1')
    expect(dispatched).not.toBeNull()
    expect(dispatched?.chunkId).toBe('chunk-zip-75001')
    expect(dispatched?.jobId).toBe('job-hvac-dallas')

    // Worker status should now be 'busy' with currentChunkId
    const workers = hub.getConnectedWorkers(orgId)
    expect(workers[0].status).toBe('busy')
    expect(workers[0].currentChunkId).toBe('chunk-zip-75001')

    // Further dispatch when queue is empty returns null
    const emptyDispatch = hub.dispatchNextChunk('worker-active-1')
    expect(emptyDispatch).toBeNull()
  })

  it('should handle chunk result message, return worker to idle, and aggregate discovered leads', () => {
    hub.registerWorker({
      type: 'register',
      workerId: 'worker-runner-1',
      orgId,
      cpuCores: 8,
      availableMemoryMb: 16000,
      clientVersion: '1.2.0',
    })

    const jobId = 'job-plumbers-austin'
    hub.queueJobChunk({
      jobId,
      chunkId: 'chunk-001',
      sourcePlugin: 'gmaps',
      params: { zip: '78701' },
      maxLeads: 10,
      timeoutMs: 30000,
    })

    hub.dispatchNextChunk('worker-runner-1')

    // Simulate worker completed chunk execution
    const resultMsg: ChunkResultMessage = {
      type: 'chunk_result',
      workerId: 'worker-runner-1',
      jobId,
      chunkId: 'chunk-001',
      success: true,
      recordsDiscovered: [
        { businessName: 'Lone Star Plumbers', phone: '512-555-0101', rating: 4.8 },
        { businessName: 'Austin Flow Pros', phone: '512-555-0102', rating: 4.9 },
      ],
      durationMs: 4200,
    }

    hub.handleChunkResult(resultMsg)

    // Worker status must return to 'idle'
    const workers = hub.getConnectedWorkers(orgId)
    expect(workers[0].status).toBe('idle')
    expect(workers[0].currentChunkId).toBeUndefined()

    // Aggregated job results should contain both records
    const records = hub.getJobResults(jobId)
    expect(records.length).toBe(2)
    expect(records[0].businessName).toBe('Lone Star Plumbers')
    expect(records[1].businessName).toBe('Austin Flow Pros')
  })
})
