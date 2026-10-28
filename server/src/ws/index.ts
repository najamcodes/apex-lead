// server/src/ws/index.ts
// WebSocket hub for real-time events - uses generic WebSocket interface for compatibility

const channels = new Map<string, Set<WebSocket>>()

export const wsHub = {
  subscribe(channel: string, ws: WebSocket) {
    if (!channels.has(channel)) channels.set(channel, new Set())
    channels.get(channel)!.add(ws)
  },

  unsubscribe(ws: WebSocket) {
    for (const subscribers of channels.values()) {
      subscribers.delete(ws)
    }
  },

  broadcast(channel: string, data: unknown) {
    const subscribers = channels.get(channel)
    if (subscribers) {
      const msg = JSON.stringify({ channel, data })
      for (const ws of subscribers) {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(msg)
        }
      }
    }
  }
}
