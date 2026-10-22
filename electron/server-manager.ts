// electron/server-manager.ts
// Manages the lifecycle and configuration of the backend API server for Electron Desktop mode.

import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import http from 'http'
import https from 'https'
import { getSettings } from '../backend/db/queries/settings.queries'

export class ServerManager {
  private serverProcess: ChildProcess | null = null
  private serverUrl = 'http://localhost:4000'
  private autoStartLocal = true
  private port = 4000

  constructor() {
    // Check environment overrides
    const envUrl = process.env.BACKEND_SERVER_URL || process.env.API_URL
    if (envUrl) {
      this.configure(envUrl)
    }
  }

  isRemote(): boolean {
    return !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(this.serverUrl)
  }

  getServerUrl(): string {
    return this.serverUrl
  }

  getPort(): number {
    return this.port
  }

  isAutoStartEnabled(): boolean {
    return this.autoStartLocal
  }

  configure(url: string, autoStartLocal?: boolean): void {
    const cleanUrl = url.trim().replace(/\/+$/, '')
    this.serverUrl = cleanUrl
    if (autoStartLocal !== undefined) {
      this.autoStartLocal = autoStartLocal
    }

    try {
      const parsed = new URL(cleanUrl)
      if (parsed.port) {
        this.port = parseInt(parsed.port, 10)
      } else if (parsed.protocol === 'https:') {
        this.port = 443
      } else {
        this.port = 80
      }
    } catch {
      this.port = 4000
    }
  }

  async loadSettings(): Promise<void> {
    try {
      const settings = await getSettings()
      if (settings.backend_server_url) {
        this.configure(
          settings.backend_server_url,
          settings.backend_auto_start_local ?? true
        )
      }
    } catch (err: any) {
      console.warn('[ServerManager] Could not load backend server settings from DB:', err?.message || err)
    }
  }

  async isServerRunning(port?: number): Promise<boolean> {
    const targetPort = port || this.port
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${targetPort}/health`, (res) => {
        resolve(res.statusCode === 200)
      })
      req.on('error', () => resolve(false))
      req.setTimeout(600, () => {
        req.destroy()
        resolve(false)
      })
    })
  }

  async testUrl(targetUrl?: string): Promise<{
    ok: boolean
    status?: number
    latencyMs: number
    error?: string
    serverInfo?: any
  }> {
    const urlStr = (targetUrl || this.serverUrl).replace(/\/+$/, '')
    const startTime = Date.now()

    return new Promise((resolve) => {
      try {
        const parsed = new URL(urlStr)
        const client = parsed.protocol === 'https:' ? https : http
        const req = client.get(`${urlStr}/health`, {
          timeout: 4000,
          headers: {
            'X-Desktop-App': 'true'
          }
        }, (res) => {
          let data = ''
          res.on('data', chunk => { data += chunk })
          res.on('end', () => {
            const latencyMs = Date.now() - startTime
            let serverInfo: any = null
            try { serverInfo = JSON.parse(data) } catch {}
            resolve({
              ok: res.statusCode === 200,
              status: res.statusCode,
              latencyMs,
              serverInfo
            })
          })
        })

        req.on('error', (err) => {
          resolve({
            ok: false,
            latencyMs: Date.now() - startTime,
            error: err.message
          })
        })

        req.on('timeout', () => {
          req.destroy()
          resolve({
            ok: false,
            latencyMs: Date.now() - startTime,
            error: 'Connection timed out (4s)'
          })
        })
      } catch (err: any) {
        resolve({
          ok: false,
          latencyMs: Date.now() - startTime,
          error: err?.message || 'Invalid server URL'
        })
      }
    })
  }

  async start(): Promise<void> {
    await this.loadSettings()

    if (this.isRemote()) {
      console.log(`[ServerManager] Operating in remote backend mode: ${this.serverUrl}. Embedded local server will not be spawned.`)
      return
    }

    if (!this.autoStartLocal) {
      console.log('[ServerManager] Auto-start for local server is disabled in settings.')
      return
    }

    const isRunning = await this.isServerRunning()
    if (isRunning) {
      console.log(`[ServerManager] Background server is already listening on port ${this.port}.`)
      return
    }

    const workspaceRoot = path.resolve(__dirname, '../..')
    const serverEntry = path.join(workspaceRoot, 'server/index.ts')

    console.log(`[ServerManager] Starting local backend server on port ${this.port}...`)

    // Try bun first, fallback to node
    try {
      this.serverProcess = spawn('bun', ['run', serverEntry], {
        cwd: workspaceRoot,
        env: {
          ...process.env,
          PORT: String(this.port),
          NODE_ENV: 'desktop',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      })
    } catch (err) {
      console.warn('[ServerManager] Failed to spawn with bun, attempting node...', err)
      this.serverProcess = spawn('node', [serverEntry], {
        cwd: workspaceRoot,
        env: {
          ...process.env,
          PORT: String(this.port),
          NODE_ENV: 'desktop',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      })
    }

    this.serverProcess.stdout?.on('data', (data) => {
      console.log(`[Server] ${data.toString().trim()}`)
    })

    this.serverProcess.stderr?.on('data', (data) => {
      console.error(`[Server ERR] ${data.toString().trim()}`)
    })

    this.serverProcess.on('exit', (code) => {
      console.log(`[ServerManager] Server process exited with code ${code}`)
      this.serverProcess = null
    })

    // Poll until healthy or 8s timeout
    const startTime = Date.now()
    while (Date.now() - startTime < 8000) {
      if (await this.isServerRunning()) {
        console.log(`[ServerManager] Local server verified healthy on port ${this.port}.`)
        return
      }
      await new Promise((r) => setTimeout(r, 250))
    }

    console.warn(`[ServerManager] Timed out waiting for server /health probe on port ${this.port}. Continuing Electron startup.`)
  }

  stop(): void {
    if (this.serverProcess) {
      console.log('[ServerManager] Stopping local backend server...')
      try {
        if (process.platform === 'win32' && this.serverProcess.pid) {
          spawn('taskkill', ['/pid', String(this.serverProcess.pid), '/f', '/t'])
        } else {
          this.serverProcess.kill('SIGTERM')
        }
      } catch (err) {
        console.warn('[ServerManager] Error stopping server process:', err)
      }
      this.serverProcess = null
    }
  }

  async restart(): Promise<{ success: boolean; port: number }> {
    this.stop()
    await new Promise((r) => setTimeout(r, 500))
    await this.start()
    const running = await this.isServerRunning()
    return { success: running, port: this.port }
  }
}

export const serverManager = new ServerManager()
