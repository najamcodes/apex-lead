# ApexLead UI Frontend (`frontend/`)

The `frontend/` directory contains the modern React + TypeScript single-page application (SPA) that powers the user interface for both the **Desktop Electron Application** and the **Next.js Web Edition**.

---

## 🏗️ Directory Structure

```
frontend/
├── components/            # Reusable UI component library
│   ├── layout/            # AppShell, Sidebar, Header, Titlebar
│   ├── ui/                # Buttons, Inputs, Modals, Badges, Tabs, Tooltips
│   └── visual-flow/       # React Flow canvas for pipeline visual editor
├── screens/               # Main application pages / views
│   ├── Dashboard/         # Real-time analytics, KPIs, funnel metrics
│   ├── Scraper/           # Lead scrapers (Google Maps, PageSpeed, Custom)
│   ├── Leads/             # CRM table, search, filters, export, tag management
│   ├── Review/            # AI review queue for one-click approval & scoring
│   ├── Outreach/          # Email campaigns, warmup status, sequence tracks
│   ├── Pipelines/         # Drag-and-drop automation workflow builder
│   ├── Workers/           # Distributed worker node management dashboard
│   ├── Settings/          # API keys, proxies, email accounts, org settings
│   ├── Tutorial/          # Step-by-step onboarding guide
│   └── Login/             # Authentication & tenant login (web mode)
├── services/              # Polymorphic API service adapters
│   ├── api.interface.ts   # Unified API interface definition
│   ├── api.ts             # Runtime environment selector (Electron vs Web)
│   ├── electron.adapter.ts # Direct IPC adapter (window.api)
│   ├── web.adapter.ts     # HTTP REST / Fetch adapter
│   ├── pipelines.adapter.ts # Server-side pipeline API adapter
│   └── ws-client.ts       # Real-time WebSocket connection manager
├── store/                 # Global state management (Zustand)
└── index.css              # Global styles & Tailwind CSS directives
```

---

## 🔌 Dual-Adapter Architecture (`services/`)

The frontend uses an **Adapter Pattern** that allows 100% of the UI code to be shared across platforms:

1. **Desktop Mode (`electron.adapter.ts`):** Direct communication over Electron IPC (`window.api`).
2. **Web Mode (`web.adapter.ts`):** Calls standard REST API endpoints over HTTP (`fetch()`) and subscribes to events via WebSocket.

The active adapter is automatically chosen at build/runtime by [`services/api.ts`](./services/api.ts).

---

## 🎨 Tech Stack
* **React 19** + **TypeScript**
* **Tailwind CSS** + **Lucide React Icons**
* **Zustand** (Lightweight state management)
* **@xyflow/react** (Visual automation workflow canvas)
* **Recharts** (Performance & ROI dashboards)
* **Framer Motion** (Smooth transitions & animations)
