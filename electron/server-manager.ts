// electron/server-manager.ts
// Manages the lifecycle of the local Hono API server for Electron Desktop mode.

import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import http from 'http'

export class ServerManager {
  private serverProcess: ChildProcess | null = null
  private readonly port = 4000

  async isServerRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${this.port}/health`, (res) => {
        resolve(res.statusCode === 200)
      })
      req.on('error', () => resolve(false))
      req.setTimeout(600, () => {
        req.destroy()
        resolve(false)
      })
    })
  }

  async start(): Promise<void> {
    const isRunning = await this.isServerRunning()
    if (isRunning) {
      console.log('[ServerManager] Background server is already listening on port 4000.')
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
        console.log('[ServerManager] Local server verified healthy on port 4000.')
        return
      }
      await new Promise((r) => setTimeout(r, 250))
    }

    console.warn('[ServerManager] Timed out waiting for server /health probe. Continuing Electron startup.')
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
}

export const serverManager = new ServerManager()
