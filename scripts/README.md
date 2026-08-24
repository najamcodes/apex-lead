# ApexLead Database & Dev Scripts (`scripts/`)

The `scripts/` directory contains CLI utilities, migration helpers, and seeders for populating local and testing databases.

---

## 📜 Available Scripts

### 1. Database Seeder (`seed.ts`)
Populates the database with a complete set of realistic demo data:
* Default organization and super_admin account (`admin@leadhunter.app` / `admin123`)
* Pre-configured outreach email templates
* Sample leads across various lifecycle stages (scraped, enriched, approved, contacted, converted)
* Realistic lead scoring, website metrics, and email logs
* Pre-built visual pipeline automations

#### How to run:
```bash
bun run scripts/seed.ts
# or
npm run db:seed
```

---

## 🗄️ Database Migrations
Migrations are located in `backend/db/migrations/` and can be executed via:
```bash
bun run backend/db/migrate.ts
# or
npm run db:migrate
```
