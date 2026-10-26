// electron/main.ts
import 'reflect-metadata'

// Suppress punycode deprecation warning from dependencies
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    return;
  }
  console.warn(warning.name, warning.message);
});

import { app, BrowserWindow, shell } from 'electron'
import path from 'path'

// Prevent GPU disk cache locked file errors on Windows
app.commandLine.appendSwitch('disable-gpu-cache')
import { initDb } from '../backend/db'
import { registerAllIpcHandlers } from './ipc'
import { initScheduler } from './scheduler'
import { initSmtp } from '@sdk/core/outreach'
import { initPluginRegistry } from '../plugins/registry'
import { workerAgent } from './worker/worker-agent'
import { serverManager } from './server-manager'

async function createWindow(): Promise<void> {
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
  await initScheduler(win)

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    win.loadURL(rendererUrl)
    win.webContents.openDevTools()
  } else if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
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

app.whenReady().then(async () => {
  await initDb()                 // 1. Database first
  await initPluginRegistry()     // 2. Plugins (need DB for config)
  await initSmtp()               // 3. SMTP transporter
  await workerAgent.init()       // 4. Child worker agent (farm node)
  await serverManager.start()    // 5. Background local API server
  await createWindow()           // 6. UI
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  serverManager.stop()
})
