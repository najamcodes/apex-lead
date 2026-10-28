export type WorkerMessageType =
  | 'WORKER_REGISTER'
  | 'WORKER_HEARTBEAT'
  | 'JOB_DISPATCH'
  | 'CHUNK_RESULT'
  | 'JOB_COMPLETE'
  | 'JOB_FAILED'

export interface BaseWorkerMessage {
  type: WorkerMessageType
  workerId: string
  timestamp: number
}

export interface WorkerRegisterMessage extends BaseWorkerMessage {
  type: 'WORKER_REGISTER'
  orgId: number
  cpuCores: number
  availableMemoryMb: number
  clientVersion: string
}

export interface JobChunk {
  chunkId: string
  jobId: string
  targetUrl: string
  scraperType: string
  parameters: Record<string, unknown>
}

export interface JobDispatchMessage extends BaseWorkerMessage {
  type: 'JOB_DISPATCH'
  jobId: string
  chunk: JobChunk
}

export interface ChunkResultMessage extends BaseWorkerMessage {
  type: 'CHUNK_RESULT'
  jobId: string
  chunkId: string
  success: boolean
  recordsDiscovered: Record<string, unknown>[]
  error?: string
}
