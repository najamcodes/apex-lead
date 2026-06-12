// electron/main.ts
import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { getDb } from '../src/db'
import { registerAllIpcHandlers } from './ipc'
import { initScheduler } from './scheduler'
import { startLocalServer, stopLocalServer } from './local-server'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Initialize IPC handlers
  registerAllIpcHandlers(win)

  // Initialize Scheduler
  initScheduler(win)

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Open external links in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  getDb() // Initialize DB on startup
  startLocalServer() // Start local HTTP server for Chrome extension
  createWindow()
})

app.on('will-quit', () => {
  stopLocalServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
