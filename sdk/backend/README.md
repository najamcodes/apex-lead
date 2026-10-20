# ApexLead Core Backend (`backend/`)

The `backend/` directory is the **platform-agnostic core domain engine** of ApexLead. It contains all database models, business logic, scraping systems, AI agents, pipeline execution graphs, and outreach automation.

Both the **Electron desktop application** (`electron/`) and the **standalone web server** (`server/`) consume this package directly.

---

## 🏗️ Architecture & Component Overview

```
backend/
├── core/                  # Core domain sub-services
│   ├── ai/                # AI clients (OpenAI, Claude, Ollama, OpenRouter, LM Studio) & prompt tasks
│   ├── analysis/          # Website quality, SEO, and PageSpeed analysis
│   ├── email-finder/      # MX checking, Hunter.io, Anymail Finder, pattern guessing
│   ├── outreach/          # SMTP sender, IMAP reply listener, email warmup engine, sequence tracker
│   └── pipelines/         # Pipeline execution helpers & step runners
├── db/                    # TypeORM database layer
│   ├── entities/          # Entity definitions (Lead, Outreach, User, Org, Pipeline, etc.)
│   ├── migrations/        # Database schema migrations
│   ├── queries/           # Data access objects (DAO) and query helpers
│   └── index.ts           # DataSource initialization (SQLite / PostgreSQL)
├── engine/                # Visual workflow graph execution engine
│   └── graph.ts           # Topological sort, state management, and node runner
├── nodes/                 # Visual pipeline node definitions
│   ├── scraper-node.ts    # Google Maps / Web scraping node
│   ├── enricher-node.ts   # Lead enrichment node
│   ├── ai-node.ts         # LLM scoring & drafting node
│   ├── outreach-node.ts   # Email sending node
│   ├── notify-node.ts     # Discord / Webhook notifications
│   ├── vision-node.ts     # Screenshot analysis node
│   └── agent-node.ts      # Autonomous agent workflow node
├── pipelines/             # Pipeline templates and presets
├── routes/                # Shared route controllers for REST/IPC parity
├── collections/           # Lead collection & grouping logic
└── templates/             # Email copy and outreach templates
```

---

## 🔑 Key Subsystems

### 1. Database Layer (`db/`)
* Built with **TypeORM**.
* Supports both **better-sqlite3 / @libsql/sqlite3** (local desktop and simple servers) and **PostgreSQL** (enterprise / multi-tenant mode).
* Provides multi-tenant organization isolation (`org_id`) and role-based access control.

### 2. Pipeline Graph Engine (`engine/` & `nodes/`)
* Executes complex multi-step lead workflows modeled in the frontend visual canvas.
* Supports conditional branching, async worker dispatching, error retries, and real-time execution event streaming.

### 3. AI & Enrichment Core (`core/ai/`, `core/analysis/`, `core/email-finder/`)
* Unified AI abstraction supporting OpenAI, Anthropic Claude, OpenRouter, Groq, and local models (Ollama, LM Studio).
* Automated website scoring, copywriting, reply triaging, and contact extraction.

### 4. Outreach & Warmup Engine (`core/outreach/`)
* Direct SMTP delivery with rate limiting, domain rotation, and jitter algorithms.
* IMAP integration for automated inbox monitoring, sentiment detection on replies, and sequence cancellation upon response.

---

## 🚀 Setup & Usage

This module is not run directly as an application; it is imported by `electron/` and `server/`.

### Run Database Migrations:
```bash
bun run backend/db/migrate.ts
```

### Seed Database with Demo Leads & Templates:
```bash
bun run scripts/seed.ts
```
