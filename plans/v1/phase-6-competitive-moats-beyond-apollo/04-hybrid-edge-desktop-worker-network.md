# Implementation Prompt: Hybrid Edge Desktop Worker Network & Zero-Cloud-RAM Scraping Hub

## Prompt Objective
Build an edge orchestration network (`WorkerHubService` on the Katal server + `DesktopWorkerAgent` in the Electron desktop client) that enables users on Free and Starter tiers to execute resource-intensive Playwright/Chromium scrapers locally on their own machine, eliminating cloud RAM usage and proxy costs while seamlessly syncing polymorphic records back to the SaaS database.

---

## Context & Architectural Rationale
Running headless Chromium browsers (Playwright/Puppeteer) in the cloud requires 300MB–800MB RAM per concurrent tab and requires rotating residential proxies ($3–$8 per GB) to prevent IP blocking on Google Maps and Yelp. For a SaaS serving thousands of free or low-cost users, cloud hosting costs would rapidly destroy gross margins.

ApexLead's **Hybrid Edge Worker Architecture** solves this definitively:
1. **Zero Cloud RAM Burden:** Heavy DOM rendering, JavaScript execution, and canvas rendering happen on the user's local machine via their installed Electron desktop app.
2. **Local Residential IP Advantage:** The user's home/office residential IP scrapes local listings naturally with minimal CAPTCHAs, without paying proxy bandwidth fees.
3. **Centralized SaaS Orchestration:** The Katal server maintains user accounts, quota tracking, multi-step cadences, and DB records. When a pipeline is launched, the server streams job chunks over an encrypted WebSocket (`wss://`) to the user's desktop worker.
4. **Resilient Job Chunking & Requeue:** If a desktop worker goes to sleep or disconnects mid-scrape, the server gracefully requeues uncompleted chunks with zero data loss.

---

## Architecture Diagram

```
+-------------------------------------------------------------+
|                  ApexLead Cloud (Katal MVC)                 |
|                                                             |
|   +-----------------------+     +-----------------------+   |
|   |   PostgreSQL / JSONB  | <-> |   WorkerHubService    |   |
|   +-----------------------+     |   (WebSocket Manager) |   |
|                                 +-----------+-----------+   |
+---------------------------------------------|---------------+
                                              | Encrypted WSS
                                              | Bidirectional
                                              v
+-------------------------------------------------------------+
|              User's Local Machine (Desktop Client)          |
|                                                             |
|   +-----------------------+     +-----------------------+   |
|   |  DesktopWorkerAgent   | <-> | Local Playwright Pool |   |
|   |  (WS Client Listener) |     | (Chromium Instances)  |   |
|   +-----------------------+     +-----------------------+   |
+-------------------------------------------------------------+
```

---

## File Changes & Additions

```
server/
├── src/
│   ├── services/
│   │   └── workers/
│   │       ├── WorkerHubService.ts
│   │       ├── EdgeJobQueue.ts
│   │       └── protocol/
│   │           └── WorkerMessages.ts
│   └── controllers/
│       └── EdgeWorkerWsController.ts
desktop/
├── src/
│   ├── worker/
│   │   ├── DesktopWorkerAgent.ts
│   │   ├── PlaywrightScraperExecutor.ts
│   │   └── LocalHardwareMonitor.ts
│   └── main/
│       └── worker-bridge.ts
```

---

## Detailed Implementation Code

### 1. WebSocket Protocol Definitions (`server/src/services/workers/protocol/WorkerMessages.ts`)

```typescript
export type WorkerMessageType = 
  | 'WORKER_REGISTER'
  | 'WORKER_HEARTBEAT'
  | 'JOB_DISPATCH'
  | 'CHUNK_RESULT'
  | 'JOB_COMPLETE'
  | 'JOB_FAILED';

export interface BaseWorkerMessage {
  type: WorkerMessageType;
  workerId: string;
  timestamp: number;
}

export interface WorkerRegisterMessage extends BaseWorkerMessage {
  type: 'WORKER_REGISTER';
  orgId: string;
  authToken: string;
  cpuCores: number;
  availableMemoryMb: number;
  clientVersion: string;
}

export interface JobDispatchMessage extends BaseWorkerMessage {
  type: 'JOB_DISPATCH';
  jobId: string;
  pipelineId: string;
  scraperType: 'gmaps' | 'yellowpages' | 'yelp' | 'houzz';
  target: {
    query: string;
    location: string;
    maxResults: number;
  };
}

export interface ChunkResultMessage extends BaseWorkerMessage {
  type: 'CHUNK_RESULT';
  jobId: string;
  records: Array<{
    businessName: string;
    phone?: string;
    website?: string;
    address?: string;
    rating?: number;
    reviews?: number;
    extra?: Record<string, any>;
  }>;
}
```

---

### 2. Cloud Server Edge Orchestrator (`server/src/services/workers/WorkerHubService.ts`)

```typescript
import { Service, Inject } from 'katal';
import { WebSocket, WebSocketServer } from 'ws';
import { DataSource } from 'typeorm';
import { 
  WorkerRegisterMessage, 
  JobDispatchMessage, 
  ChunkResultMessage 
} from './protocol/WorkerMessages';
import { RecordRepository } from '../../repositories/RecordRepository';

interface ConnectedWorker {
  id: string;
  orgId: string;
  socket: WebSocket;
  activeJobId: string | null;
  lastPing: number;
}

@Service()
export class WorkerHubService {
  private workers = new Map<string, ConnectedWorker>();
  private wss: WebSocketServer | null = null;

  constructor(
    @Inject('DataSource') private dataSource: DataSource,
    @Inject(RecordRepository) private recordRepo: RecordRepository
  ) {}

  public init(server: any): void {
    this.wss = new WebSocketServer({ server, path: '/api/v1/edge-worker' });

    this.wss.on('connection', (ws) => {
      let workerId: string | null = null;

      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'WORKER_REGISTER') {
            workerId = this.handleRegister(ws, msg as WorkerRegisterMessage);
          } else if (msg.type === 'CHUNK_RESULT') {
            await this.handleChunkResult(msg as ChunkResultMessage);
          } else if (msg.type === 'WORKER_HEARTBEAT') {
            if (workerId && this.workers.has(workerId)) {
              this.workers.get(workerId)!.lastPing = Date.now();
            }
          }
        } catch (err: any) {
          console.error('[WorkerHub] Malformed frame:', err.message);
        }
      });

      ws.on('close', () => {
        if (workerId) {
          this.handleDisconnect(workerId);
        }
      });
    });

    // Cleanup stale workers every 30s
    setInterval(() => this.pruneStaleWorkers(), 30000);
  }

  private handleRegister(ws: WebSocket, msg: WorkerRegisterMessage): string {
    const id = `worker_${msg.orgId}_${Date.now()}`;
    this.workers.set(id, {
      id,
      orgId: msg.orgId,
      socket: ws,
      activeJobId: null,
      lastPing: Date.now(),
    });

    ws.send(JSON.stringify({ type: 'WORKER_REGISTER_ACK', workerId: id }));
    console.log(`[WorkerHub] Edge worker connected: ${id} (Org: ${msg.orgId})`);
    return id;
  }

  public async dispatchJobToDesktop(orgId: string, jobSpec: Omit<JobDispatchMessage, 'type' | 'workerId' | 'timestamp'>): Promise<boolean> {
    // Find available worker for this organization
    const available = Array.from(this.workers.values()).find(
      (w) => w.orgId === orgId && w.activeJobId === null && w.socket.readyState === WebSocket.OPEN
    );

    if (!available) {
      return false; // No desktop worker online for this tenant
    }

    available.activeJobId = jobSpec.jobId;
    const payload: JobDispatchMessage = {
      ...jobSpec,
      type: 'JOB_DISPATCH',
      workerId: available.id,
      timestamp: Date.now(),
    };

    available.socket.send(JSON.stringify(payload));
    return true;
  }

  private async handleChunkResult(msg: ChunkResultMessage): Promise<void> {
    const worker = this.workers.get(msg.workerId);
    if (!worker) return;

    // Ingest records directly into polymorphic JSON database
    for (const rec of msg.records) {
      await this.recordRepo.saveRecord(worker.orgId, {
        dataType: 'lead.local_business',
        source: 'edge_desktop_worker',
        data: rec,
        identities: [
          ...(rec.phone ? [{ type: 'phone', value: rec.phone }] : []),
          ...(rec.website ? [{ type: 'domain', value: rec.website }] : []),
        ],
      });
    }
  }

  private handleDisconnect(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker && worker.activeJobId) {
      console.warn(`[WorkerHub] Worker ${workerId} dropped during job ${worker.activeJobId}. Requeueing.`);
      // Requeue job for cloud fallback or next desktop reconnection
    }
    this.workers.delete(workerId);
  }

  private pruneStaleWorkers(): void {
    const now = Date.now();
    for (const [id, worker] of this.workers.entries()) {
      if (now - worker.lastPing > 45000) {
        worker.socket.terminate();
        this.workers.delete(id);
      }
    }
  }
}
```

---

### 3. Local Desktop Worker Client (`desktop/src/worker/DesktopWorkerAgent.ts`)

```typescript
import WebSocket from 'ws';
import os from 'node:os';
import { PlaywrightScraperExecutor } from './PlaywrightScraperExecutor';

export class DesktopWorkerAgent {
  private ws: WebSocket | null = null;
  private workerId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isExecuting = false;

  constructor(
    private serverUrl: string,
    private orgId: string,
    private authToken: string,
    private executor: PlaywrightScraperExecutor
  ) {}

  public connect(): void {
    this.ws = new WebSocket(`${this.serverUrl}/api/v1/edge-worker`);

    this.ws.on('open', () => {
      // Register with the server
      const registerPayload = {
        type: 'WORKER_REGISTER',
        orgId: this.orgId,
        authToken: this.authToken,
        cpuCores: os.cpus().length,
        availableMemoryMb: Math.round(os.freemem() / 1024 / 1024),
        clientVersion: '1.0.0',
        timestamp: Date.now(),
      };
      this.ws?.send(JSON.stringify(registerPayload));

      // Start 15s heartbeat
      this.heartbeatInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'WORKER_HEARTBEAT', workerId: this.workerId, timestamp: Date.now() }));
        }
      }, 15000);
    });

    this.ws.on('message', async (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'WORKER_REGISTER_ACK') {
        this.workerId = msg.workerId;
        console.log('[DesktopWorker] Registered with Hub. Worker ID:', this.workerId);
      } else if (msg.type === 'JOB_DISPATCH') {
        await this.handleJobDispatch(msg);
      }
    });

    this.ws.on('close', () => {
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      setTimeout(() => this.connect(), 5000); // Reconnect after 5s
    });
  }

  private async handleJobDispatch(job: any): Promise<void> {
    if (this.isExecuting) return;
    this.isExecuting = true;

    try {
      // Run local headless Playwright using the user's local residential internet
      await this.executor.executeScrape(job.target, (chunk) => {
        // Stream extracted chunks back to Cloud Hub
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'CHUNK_RESULT',
            workerId: this.workerId,
            jobId: job.jobId,
            records: chunk,
            timestamp: Date.now(),
          }));
        }
      });

      // Notify completion
      this.ws?.send(JSON.stringify({
        type: 'JOB_COMPLETE',
        workerId: this.workerId,
        jobId: job.jobId,
        timestamp: Date.now(),
      }));
    } catch (err: any) {
      this.ws?.send(JSON.stringify({
        type: 'JOB_FAILED',
        workerId: this.workerId,
        jobId: job.jobId,
        error: err.message,
        timestamp: Date.now(),
      }));
    } finally {
      this.isExecuting = false;
    }
  }
}
```

---

## Verification & Acceptance Criteria
1. **Desktop Handshake:** Start local desktop client; verify `WORKER_REGISTER` frame reaches the server and responds with `WORKER_REGISTER_ACK`.
2. **Chunked Stream Ingestion:** Dispatch a Google Maps test query; verify local Chromium browser launches, extracts 10 listings, and streams them back via `CHUNK_RESULT`.
3. **Database Insertion:** Inspect PostgreSQL `records` table on the server to verify records streamed from the desktop worker are saved in polymorphic JSON format with identities.
4. **Resilient Reconnection:** Terminate the desktop client mid-scrape; verify `WorkerHubService` logs worker disconnection and marks the job available for requeue.
