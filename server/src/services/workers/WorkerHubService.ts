import {
  WorkerRegisterMessage,
  JobChunk,
  ChunkResultMessage,
} from './protocol/WorkerMessages'

export interface ConnectedWorker {
  workerId: string
  orgId: number
  cpuCores: number
  availableMemoryMb: number
  clientVersion: string
  lastHeartbeat: Date
  status: 'idle' | 'busy' | 'offline'
  currentChunkId?: string
}

export class WorkerHubService {
  private workers: Map<string, ConnectedWorker> = new Map()
  private pendingChunks: JobChunk[] = []
  private completedResults: Map<string, Record<string, unknown>[]> = new Map()

  public registerWorker(msg: WorkerRegisterMessage): ConnectedWorker {
    const worker: ConnectedWorker = {
      workerId: msg.workerId,
      orgId: msg.orgId,
      cpuCores: msg.cpuCores,
      availableMemoryMb: msg.availableMemoryMb,
      clientVersion: msg.clientVersion,
      lastHeartbeat: new Date(),
      status: 'idle',
    }
    this.workers.set(msg.workerId, worker)
    return worker
  }

  public recordHeartbeat(workerId: string): boolean {
    const worker = this.workers.get(workerId)
    if (!worker) return false
    worker.lastHeartbeat = new Date()
    if (worker.status === 'offline') worker.status = 'idle'
    return true
  }

  public getConnectedWorkers(orgId: number): ConnectedWorker[] {
    const now = Date.now()
    return Array.from(this.workers.values()).filter((w) => {
      // Mark offline if no heartbeat for 60 seconds
      if (now - w.lastHeartbeat.getTime() > 60000) {
        w.status = 'offline'
      }
      return w.orgId === orgId
    })
  }

  public queueJobChunk(chunk: JobChunk): void {
    this.pendingChunks.push(chunk)
  }

  public dispatchNextChunk(workerId: string): JobChunk | null {
    const worker = this.workers.get(workerId)
    if (!worker || worker.status === 'offline') return null

    if (this.pendingChunks.length === 0) return null

    const chunk = this.pendingChunks.shift()!
    worker.status = 'busy'
    worker.currentChunkId = chunk.chunkId
    return chunk
  }

  public handleChunkResult(result: ChunkResultMessage): void {
    const worker = this.workers.get(result.workerId)
    if (worker) {
      worker.status = 'idle'
      worker.currentChunkId = undefined
    }

    if (result.success && result.recordsDiscovered) {
      const existing = this.completedResults.get(result.jobId) || []
      this.completedResults.set(result.jobId, [...existing, ...result.recordsDiscovered])
    } else if (!result.success) {
      // Re-queue chunk for another worker if failed
      console.warn(`[WorkerHub] Chunk ${result.chunkId} failed on worker ${result.workerId}: ${result.error}`)
    }
  }

  public getJobResults(jobId: string): Record<string, unknown>[] {
    return this.completedResults.get(jobId) || []
  }
}
