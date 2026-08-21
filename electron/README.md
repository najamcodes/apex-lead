# ApexLead Desktop (`electron/`)

The `electron/` directory houses the desktop runtime for ApexLead. It bundles the application for **Windows, macOS, and Linux**, providing direct hardware access, native background execution, embedded SQLite database storage, and stealth Playwright browser automation.

---

## 🏗️ Directory Structure

```
electron/
├── main.ts                # Application lifecycle, main window, and service bootstrap
├── preload.ts             # Secure IPC context bridge exposing 'window.api' to the UI
├── ipc/                   # Modular IPC handlers (translates UI requests to backend operations)
│   ├── ai.ipc.ts          # AI scoring and drafting handlers
│   ├── bulk.ipc.ts        # Bulk lead imports/exports and actions
│   ├── email-accounts.ipc.ts # SMTP/IMAP account management
│   ├── leads.ipc.ts       # Lead CRUD and status transitions
│   ├── outreach.ipc.ts    # Sequence tracking and manual dispatch
│   ├── plugins.ipc.ts     # Plugin activation and execution
│   ├── scraper.ipc.ts     # Playwright stealth scraping controllers
│   ├── settings.ipc.ts    # Application configuration & API keys
├── scheduler/             # Cron scheduler for background email sending & warmup
└── worker/                # Distributed Worker Agent (connects to central backend as a slave)
```

---

## ⚙️ Operating Modes

The Electron app can run in two primary modes:

### Mode 1: Autonomous Desktop (Master & Local DB)
* Runs independently with an embedded SQLite database (`better-sqlite3`).
* UI communicates in-memory via `window.api` Electron IPC.
* Best for individual local usage on desktop/laptop.

### Mode 2: Distributed Slave / Worker Node
* Managed by [`worker/worker-agent.ts`](./worker/worker-agent.ts).
* Connects over WebSocket (`ws://<SERVER_URL>/ws/worker`) to a central Hono server (`server/`).
* Receives distributed scraping tasks, executes Playwright stealth sessions locally through residential connections, and streams results back to the central hub.

---

## 🚀 Setup & Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
```bash
npm run dev
```

### 3. Build & Package Installers
```bash
# Windows (.exe installer)
npm run build:win

# macOS (.dmg / .zip)
npm run build:mac

# Linux (.AppImage / .deb)
npm run build:linux

# Unpacked directory test
npm run build:unpack
```
