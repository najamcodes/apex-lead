# Phase 1 — Prompt 03: Merging `backend/` and `sdk/backend/` into `server/`

> **Objective:** Unify all fragmented backend code into a single source of truth in `server/`, eliminating redundant proxy files while maintaining 100% backward compatibility for Electron and existing unit tests.

---

## 1. Inventory & Consolidation Mapping

Currently, backend logic is duplicated across:
1. `backend/`: Legacy folder with re-exports and partial duplicates.
2. `sdk/backend/`: Monorepo package containing the pipeline DAG engine and nodes.
3. `server/`: Hono standalone server.

### The Unified Target Mapping

| Source Path | Target Destination in `server/` | Notes |
| :--- | :--- | :--- |
| `sdk/backend/db/entities/*` | `server/src/models/*` | Standard TypeORM entities |
| `sdk/backend/db/queries/*` | `server/src/repositories/*` | Refactored into clean Tenant Repositories |
| `sdk/backend/db/data-source.ts`| `server/src/db/data-source.ts` | Dual-driver PostgreSQL & SQLite DataSource |
| `sdk/backend/engine/*` | `server/src/engine/*` | DAG graph engine, topological sorter, runner |
| `sdk/backend/nodes/*` | `server/src/nodes/*` | All 51 visual pipeline nodes |
| `sdk/backend/collections/*` | `server/src/collections/*` | Collection definitions & dynamic schemas |
| `sdk/backend/pipelines/*` | `server/src/pipelines/*` | Seeder definitions and DAG runner helpers |
| `sdk/backend/templates/*` | `server/src/templates/*` | Built-in pipeline template JSON definitions |

---

## 2. Step-by-Step Migration Commands

### Step 1: Copy Engine, Nodes, and Templates to `server/src/`

```bash
# 1. Create target directories in server
mkdir -p server/src/engine server/src/nodes server/src/collections server/src/pipelines server/src/templates

# 2. Sync engine, nodes, and templates from sdk/backend/
cp -r sdk/backend/engine/* server/src/engine/
cp -r sdk/backend/nodes/* server/src/nodes/
cp -r sdk/backend/collections/* server/src/collections/
cp -r sdk/backend/pipelines/* server/src/pipelines/
cp -r sdk/backend/templates/* server/src/templates/
```

### Step 2: Establish Single Source of Truth in `tsconfig.json`

To ensure existing tests (`tests/unit/...`) and Electron files (`electron/...`) continue compiling without having to rewrite 300+ import statements simultaneously, configure root TypeScript path mappings:

```json
// tsconfig.json (Root)
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@sdk/core/*": ["sdk/core/*"],
      "@sdk/backend/*": ["server/src/*"],
      "backend/*": ["server/src/*"],
      "@server/*": ["server/src/*"]
    }
  }
}
```

And in `server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": {
      "@sdk/core/*": ["../sdk/core/*"],
      "@/*": ["./src/*"]
    }
  }
}
```

---

## 3. Backward Compatibility Shim

In `sdk/backend/index.ts` and `backend/index.ts`, convert the root files into re-export shims pointing to `server/src`:

```ts
// sdk/backend/index.ts
export * from '../../server/src/engine'
export * from '../../server/src/nodes'
export * from '../../server/src/models'
export * from '../../server/src/repositories'
```

```ts
// backend/index.ts
export * from '../server/src'
```

---

## 4. Electron Desktop Integration: Embedded Server vs Remote Client

In `electron/server-manager.ts`, Electron can run in two modes:

### Mode 1: Remote SaaS Mode (Recommended for lightweight desktop apps)
The desktop client simply talks to `https://api.yourdomain.com` over HTTPS and WSS. No local Node backend or database runs on the user's computer.

### Mode 2: Local Embedded Server (Offline / Privacy Mode)
When running offline or in self-hosted desktop mode, Electron boots the unified `server/` instance directly on `localhost:4000`:

```ts
// electron/server-manager.ts
import { spawn } from 'child_process'
import { join } from 'path'

export class ServerManager {
  private serverProcess: any = null

  startLocalServer(port = 4000) {
    const serverScript = join(__dirname, '../../server/dist/index.js')
    this.serverProcess = spawn('bun', [serverScript], {
      env: {
        ...process.env,
        PORT: String(port),
        DB_TYPE: 'sqlite',
        DATABASE_URL: join(app.getPath('userData'), 'apexlead.db'),
      },
    })
  }

  stopLocalServer() {
    if (this.serverProcess) {
      this.serverProcess.kill()
      this.serverProcess = null
    }
  }
}
```

---

## 5. Cleaning Up Legacy Redundant Files
Once all imports resolve to `server/src/`:
1. Safely remove duplicate entities in `backend/db/entities/`.
2. Remove duplicate query files in `backend/db/queries/`.
3. Verify with `npm run typecheck` that 0 missing import errors remain.
