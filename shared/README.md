# ApexLead Shared Types & Contracts (`shared/`)

The `shared/` directory contains shared TypeScript types, data models, IPC channel constants, and validation schemas used across all packages (`backend/`, `electron/`, `frontend/`, `server/`, and `web/`).

---

## 🏗️ Directory Structure

```
shared/
└── types/
    ├── index.ts           # Central barrel export for all shared types
    ├── lead.ts            # Lead interface, status enums, and score definitions
    ├── outreach.ts        # Campaign, sequence, email account, and email log interfaces
    ├── pipeline.ts        # Visual node, edge, and workflow graph execution contracts
    ├── scraper.ts         # Scraper job configurations, status, and payload formats
    ├── settings.ts        # Application settings, API key models, proxy settings
    ├── tenant.ts          # Organization, user roles, and permission types
    └── ipc.ts             # IPC channel enumeration (ensures type safety between Electron main & renderer)
```

---

## 💡 Usage Example

```typescript
import { IPC, type Lead, type LeadStatus } from '../shared/types'

// Type-safe IPC invocation
const leads: Lead[] = await ipcRenderer.invoke(IPC.LEADS_GET_ALL, { status: 'approved' })
```
