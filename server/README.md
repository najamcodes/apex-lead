# ApexLead Standalone API Server (`server/`)

The `server/` directory contains the **Katal-powered REST and WebSocket API Gateway**. It enables ApexLead to run as a multi-tenant cloud application, headless backend, or Dockerized home-server deployment.

---

## 🏗️ Directory Structure

```
server/
├── index.ts               # Katal app bootstrap, route mounting & HTTP server
├── polyfill.ts            # Node/Bun runtime compatibility shims
├── src/
│   ├── auth.ts            # JWT authentication and password hashing
│   ├── context.ts         # AsyncLocalStorage request context (user/tenant tracking)
│   ├── middleware/        # Request logging, rate limiting, and CORS
│   ├── routes/            # REST API endpoints (leads, scraper, ai, outreach, orgs, workers)
│   ├── utils/             # Pino structured logger & Sentry telemetry
│   └── ws/                # WebSocket managers
│       ├── index.ts       # Real-time client UI event broadcasting
│       └── worker-hub.ts  # Distributed worker farm coordinator (dispatches jobs to desktop slaves)
```

---

## 🔑 Key Capabilities

1. **REST API Gateway:** Exposes modular REST endpoints for leads, scraping, enrichments, outreach, and multi-tenant operations.
2. **Worker Farm Coordinator (`src/ws/worker-hub.ts`):** Orchestrates connected desktop worker nodes over WebSocket (`/ws/worker`), balancing scraping tasks across active instances.
3. **Multi-Tenancy & RBAC:** Enforces organization boundaries (`org_id`) and roles (`super_admin`, `admin`, `member`, `viewer`).

---

## 🚀 Setup & Execution

### 1. Install Dependencies
```bash
cd server
bun install # or npm install
```

### 2. Run Development Server
```bash
bun run index.ts
```
* **API Base:** `http://localhost:4000`
* **Health Check:** `http://localhost:4000/health`

### 3. Environment Variables
| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Listening port | `4000` |
| `JWT_SECRET` | Secret key for signing user tokens | `leadhunter_secret_key` |
| `CORS_ORIGIN` | Allowed web origins (comma separated) | `http://localhost:3000` |
| `LEADHUNTER_DB_PATH` | Path to SQLite file (if using SQLite) | `./data/leadhunter.db` |
| `DATABASE_URL` | PostgreSQL connection URL (optional) | *none (uses SQLite)* |
