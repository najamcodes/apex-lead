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
import { initDb } from '../backend/db'
import { registerAllIpcHandlers } from './ipc'
import { initScheduler } from './scheduler'
import { startLocalServer, stopLocalServer } from './local-server'
import { initSmtp } from '../backend/core/outreach'
import { startNightlyRunner } from './pipeline/nightly-runner'
import { initPluginRegistry } from '../plugins/registry'

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

app.whenReady().then(async () => {
  await initDb()                 // 1. Database first
  await initPluginRegistry()     // 2. Plugins (need DB for config)
  await initSmtp()               // 3. SMTP transporter
  startLocalServer()             // 4. Chrome extension local server
  startNightlyRunner()           // 5. Pipeline nightly runner
  await createWindow()           // 6. UI
})

app.on('will-quit', () => {
  stopLocalServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
