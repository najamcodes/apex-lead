// src/db/migrations.ts
import type { Database } from 'better-sqlite3'

interface Migration {
  name: string
  up: string
}

// Add new migrations here as the schema evolves.
// Never modify existing migrations — always add new ones.
const MIGRATIONS: Migration[] = [
  {
    name: '001_initial_schema',
    up: '', // handled by schema.ts on first run
  },
  // Future: { name: '002_add_outreach_emails_table', up: '...' }
]

export function runMigrations(db: Database): void {
  for (const migration of MIGRATIONS) {
    const already = db
      .prepare('SELECT id FROM migrations WHERE name = ?')
      .get(migration.name)
    if (already) continue
    if (migration.up) {
      db.exec(migration.up)
    }
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name)
  }
}
