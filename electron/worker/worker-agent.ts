// electron/worker/worker-agent.ts
// Background service in Electron that connects to the central web backend as a child worker node.
// Listens for dispatched scraping tasks and pipelines, executes them locally with desktop capabilities,
// and streams progress and scraped records back to the central server.

import os from 'os'
import { randomUUID } from 'crypto'
import { getSettings, saveSettings } from '../../backend/db/queries/settings.queries'
import { executePipeline, getRunState } from '../../backend/engine/graph'
import { registerBuiltInNodes } from '../../backend/nodes'
import type { WorkerAgentConfig, WorkerAgentStatus } from '@sdk/core/worker'

export type { WorkerAgentConfig, WorkerAgentStatus }

class WorkerAgentService {
  private ws: any = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private activeJobsCount = 0
  private isConnecting = false
  private isConnected = false
  private lastError: string | undefined
  private lastHeartbeat: string | undefined

  private config: WorkerAgentConfig = {
    enabled: false,
    serverUrl: 'http://localhost:4000',
    workerId: '',
    workerName: `${os.hostname()} Desktop`,
    orgId: 1,
    maxConcurrency: 2,
  }

  async init(): Promise<void> {
    await this.loadConfig()
    if (this.config.enabled) {
      this.connect()
    }
  }

  async loadConfig(): Promise<WorkerAgentConfig> {
    try {
      const s = await getSettings()
      const raw = (s as any).worker_config
      let stored: Partial<WorkerAgentConfig> = {}
      if (raw) {
        try { stored = JSON.parse(raw) } catch {}
      }

      this.config = {
        enabled: stored.enabled ?? false,
        serverUrl: stored.serverUrl || (s as any).backend_server_url || 'http://localhost:4000',
        workerId: stored.workerId || randomUUID(),
        workerName: stored.workerName || `${os.hostname()} (${os.platform()})`,
        pairingToken: stored.pairingToken,
        orgId: stored.orgId || 1,
        userId: stored.userId,
        maxConcurrency: stored.maxConcurrency || 2,
      }

      // If workerId was generated, persist it
      if (!stored.workerId) {
        await this.saveConfig(this.config)
      }
    } catch (err: any) {
      console.warn('[WorkerAgent] Failed to load config:', err?.message || err)
    }
    return this.config
  }

  async saveConfig(cfg: Partial<WorkerAgentConfig>): Promise<WorkerAgentConfig> {
    this.config = { ...this.config, ...cfg }
    try {
      await saveSettings({
        worker_config: JSON.stringify(this.config),
      } as any)
    } catch (err: any) {
      console.warn('[WorkerAgent] Failed to save config to DB:', err?.message || err)
    }

    if (this.config.enabled && !this.isConnected && !this.isConnecting) {
      this.connect()
    } else if (!this.config.enabled && (this.isConnected || this.isConnecting)) {
      this.disconnect()
    }

    return this.config
  }

  getStatus(): WorkerAgentStatus {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      config: this.config,
      activeJobs: this.activeJobsCount,
      lastHeartbeat: this.lastHeartbeat,
      lastError: this.lastError,
    }
  }

  connect(): void {
    if (!this.config.enabled) return
    if (this.isConnecting || this.isConnected) return

    this.isConnecting = true
    this.lastError = undefined

    // Normalize WS URL
    let wsUrl = this.config.serverUrl.replace(/^http/, 'ws')
    if (!wsUrl.endsWith('/ws/workers') && !wsUrl.endsWith('/ws')) {
      wsUrl = `${wsUrl.replace(/\/+$/, '')}/ws/workers`
    }

    console.log(`[WorkerAgent] Connecting to central backend at ${wsUrl}...`)

    try {
      // Use global WebSocket in modern Electron/Node
      const WsClass = typeof WebSocket !== 'undefined' ? WebSocket : require('ws')
      this.ws = new WsClass(wsUrl)

      const onOpen = () => {
        this.isConnected = true
        this.isConnecting = false
        this.lastError = undefined
        console.log(`[WorkerAgent] Connected to central orchestrator at ${wsUrl}`)

        // Send registration
        this.send({
          type: 'worker:register',
          data: {
            workerId: this.config.workerId,
            orgId: this.config.orgId,
            userId: this.config.userId,
            name: this.config.workerName,
            platform: os.platform(),
            capabilities: ['google_maps', 'browser', 'pipeline_executor', 'residential_ip'],
            maxConcurrency: this.config.maxConcurrency,
            version: '1.0.0',
          },
        })

        this.startHeartbeat()
      }

      const onMessage = (event: any) => {
        try {
          const raw = typeof event === 'string' ? event : (event.data ? event.data.toString() : event.toString())
          const msg = JSON.parse(raw)
          this.handleServerMessage(msg)
        } catch (err: any) {
          console.error('[WorkerAgent] Error parsing incoming message:', err?.message || err)
        }
      }

      const onClose = () => {
        this.isConnected = false
        this.isConnecting = false
        this.stopHeartbeat()
        console.log('[WorkerAgent] Disconnected from central orchestrator')
        this.scheduleReconnect()
      }

      const onError = (err: any) => {
        this.lastError = err?.message || 'WebSocket connection error'
        console.warn('[WorkerAgent] WebSocket error:', this.lastError)
      }

      if (typeof this.ws.on === 'function') {
        this.ws.on('open', onOpen)
        this.ws.on('message', onMessage)
        this.ws.on('close', onClose)
        this.ws.on('error', onError)
      } else if (typeof this.ws.addEventListener === 'function') {
        this.ws.addEventListener('open', onOpen)
        this.ws.addEventListener('message', onMessage)
        this.ws.addEventListener('close', onClose)
        this.ws.addEventListener('error', onError)
      }
    } catch (err: any) {
      this.isConnected = false
      this.isConnecting = false
      this.lastError = err?.message || String(err)
      console.error('[WorkerAgent] Failed to instantiate WebSocket:', err)
      this.scheduleReconnect()
    }
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }
    this.isConnected = false
    this.isConnecting = false
  }

  private send(msg: { type: string; data: any }): void {
    if (this.ws && this.isConnected) {
      try {
        const payload = JSON.stringify(msg)
        this.ws.send(payload)
      } catch (err: any) {
        console.error('[WorkerAgent] Failed to send message:', err?.message || err)
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.lastHeartbeat = new Date().toISOString()
      this.send({
        type: 'worker:heartbeat',
        data: {
          activeJobs: this.activeJobsCount,
          timestamp: Date.now(),
        },
      })
    }, 20_000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (!this.config.enabled) return
    if (this.reconnectTimer) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.config.enabled && !this.isConnected && !this.isConnecting) {
        this.connect()
      }
    }, 5_000)
  }

  private async handleServerMessage(msg: { type: string; data: any }): Promise<void> {
    const { type, data } = msg

    switch (type) {
      case 'worker:registered':
        console.log(`[WorkerAgent] Successfully registered with central farm at ${data.serverTime}`)
        break

      case 'worker:heartbeat_ack':
        break

      case 'dispatch:pipeline':
        await this.executeRemotePipeline(data)
        break

      default:
        console.log(`[WorkerAgent] Received unhandled server message type: ${type}`)
    }
  }

  private async executeRemotePipeline(data: {
    runId: string
    pipeline: any
    input: Record<string, unknown>
    orgId: number
    proxyConfig?: any
  }): Promise<void> {
    const { runId, pipeline, input, proxyConfig } = data
    this.activeJobsCount += 1

    console.log(`[WorkerAgent] Starting remote pipeline execution: runId=${runId}, pipeline=${pipeline.name}`)
    registerBuiltInNodes()

    try {
      const handle = await executePipeline(pipeline, {
        runId,
        input: input || {},
        userRole: 'admin',
        proxyConfig: proxyConfig || null,
        onRecord: (rec) => {
          this.send({
            type: 'worker:record',
            data: {
              orgId: data.orgId || this.config.orgId,
              collection: rec.collection || 'leads',
              record: rec.data,
              source: `worker:${this.config.workerId}:${pipeline.name || 'pipeline'}`,
            },
          })
        },
        onProgress: (progressMsg) => {
          this.send({
            type: 'worker:progress',
            data: {
              runId,
              nodeId: progressMsg.nodeId,
              message: progressMsg.message,
              stats: getRunState(handle).stats,
              logEntry: {
                timestamp: new Date().toISOString(),
                nodeId: progressMsg.nodeId,
                level: 'info',
                message: progressMsg.message,
              },
            },
          })
        },
      })

      // Wait until completed
      const maxWait = 60 * 60 * 1000 // 1 hour
      const start = Date.now()
      while (!handle.isDone() && Date.now() - start < maxWait) {
        await new Promise(r => setTimeout(r, 1500))
        const state = getRunState(handle)
        this.send({
          type: 'worker:progress',
          data: {
            runId,
            stats: state.stats,
          },
        })
      }

      const finalState = getRunState(handle)
      if (handle.isDone()) {
        this.send({
          type: 'worker:completed',
          data: {
            runId,
            stats: finalState.stats,
            log: finalState.log,
          },
        })
        console.log(`[WorkerAgent] Successfully finished pipeline run ${runId}`)
      } else {
        this.send({
          type: 'worker:failed',
          data: {
            runId,
            error: 'Pipeline execution timed out',
            stats: finalState.stats,
            log: finalState.log,
          },
        })
      }
    } catch (err: any) {
      console.error(`[WorkerAgent] Pipeline run ${runId} execution error:`, err)
      this.send({
        type: 'worker:failed',
        data: {
          runId,
          error: err?.message || String(err),
        },
      })
    } finally {
      this.activeJobsCount = Math.max(0, this.activeJobsCount - 1)
    }
  }
}

export const workerAgent = new WorkerAgentService()
