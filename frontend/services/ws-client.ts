// src/services/ws-client.ts
// WebSocket event bus for the web adapter.
// Replaces Electron's ipcRenderer.on() for real-time events
// (scraper progress, analysis progress, pipeline logs, etc.)

type Handler = (data: any) => void

const listeners = new Map<string, Set<Handler>>()
let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let wsUrl: string | null = null

function handleMessage(e: MessageEvent) {
  try {
    const { channel, data } = JSON.parse(e.data)
    const handlers = listeners.get(channel)
    if (handlers) {
      handlers.forEach(h => h(data))
    }
  } catch {
    // ignore malformed messages
  }
}

function attemptReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (wsUrl) {
      connect(wsUrl)
    }
  }, 3000)
}

function connect(url: string) {
  wsUrl = url
  try {
    ws = new WebSocket(url)
    ws.onopen = () => {
      ws?.send(JSON.stringify({ type: 'subscribe', channels: [
        'scraper:progress',
        'analysis:progress',
        'pipeline:log',
        'emailFinder:progress',
        'emailVerifier:progress',
        'scheduler:completed'
      ]}))
    }
    ws.onmessage = handleMessage
    ws.onclose = () => attemptReconnect()
    ws.onerror = () => ws?.close()
  } catch {
    attemptReconnect()
  }
}

export function getWsUrlFromHttpUrl(httpUrl: string): string {
  try {
    const url = new URL(httpUrl)
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${url.host}/ws`
  } catch {
    return 'ws://localhost:4000/ws'
  }
}

export const wsClient = {
  /**
   * Connect to the WebSocket server.
   * Call once on app mount.
   */
  connect(url?: string) {
    const targetUrl = url || getWsUrlFromHttpUrl('http://localhost:4000')
    connect(targetUrl)
  },

  /**
   * Reconnect to a different base HTTP URL.
   */
  reconnectTo(baseUrl: string) {
    const newWsUrl = getWsUrlFromHttpUrl(baseUrl)
    this.disconnect()
    this.connect(newWsUrl)
  },

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    wsUrl = null
    ws?.close()
    ws = null
  },

  /**
   * Subscribe to a channel. Returns an unsubscribe function.
   * This mirrors the Electron pattern where onProgress returns () => void.
   */
  subscribe(channel: string, handler: Handler): () => void {
    if (!listeners.has(channel)) {
      listeners.set(channel, new Set())
    }
    listeners.get(channel)!.add(handler)
    return () => {
      listeners.get(channel)?.delete(handler)
    }
  }
}
