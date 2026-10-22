import { describe, it, expect } from 'bun:test'
import { IPC } from '../../../shared/types'
import { ServerManager } from '../../../electron/server-manager'
import { getWsUrlFromHttpUrl } from '../../../frontend/services/ws-client'

describe('Backend Server Configuration & Resolution', () => {
  it('should expose all required server IPC channels', () => {
    expect(IPC.SERVER_GET_CONFIG).toBe('server:getConfig')
    expect(IPC.SERVER_SAVE_CONFIG).toBe('server:saveConfig')
    expect(IPC.SERVER_TEST_URL).toBe('server:testUrl')
    expect(IPC.SERVER_RESTART_LOCAL).toBe('server:restartLocal')
  })

  it('should properly identify local vs remote server endpoints', () => {
    const mgr = new ServerManager()

    mgr.configure('http://localhost:4000')
    expect(mgr.isRemote()).toBe(false)
    expect(mgr.getPort()).toBe(4000)

    mgr.configure('http://127.0.0.1:5000')
    expect(mgr.isRemote()).toBe(false)
    expect(mgr.getPort()).toBe(5000)

    mgr.configure('https://api.leadgendesk.com')
    expect(mgr.isRemote()).toBe(true)
    expect(mgr.getPort()).toBe(443)

    mgr.configure('http://my-internal-server.local:8080')
    expect(mgr.isRemote()).toBe(true)
    expect(mgr.getPort()).toBe(8080)
  })

  it('should manage autoStartLocal configuration toggle', () => {
    const mgr = new ServerManager()
    mgr.configure('http://localhost:4000', true)
    expect(mgr.isAutoStartEnabled()).toBe(true)

    mgr.configure('http://localhost:4000', false)
    expect(mgr.isAutoStartEnabled()).toBe(false)
  })

  it('should correctly transform HTTP/HTTPS URLs to WebSocket WS/WSS endpoints', () => {
    expect(getWsUrlFromHttpUrl('http://localhost:4000')).toBe('ws://localhost:4000/ws')
    expect(getWsUrlFromHttpUrl('http://127.0.0.1:5000/')).toBe('ws://127.0.0.1:5000/ws')
    expect(getWsUrlFromHttpUrl('https://api.apexlead.io')).toBe('wss://api.apexlead.io/ws')
    expect(getWsUrlFromHttpUrl('https://api.apexlead.io/v1')).toBe('wss://api.apexlead.io/ws')
  })
})
