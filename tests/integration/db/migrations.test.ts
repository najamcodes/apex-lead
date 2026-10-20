import "../../../server/polyfill";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { DataSource } from "typeorm";
import { InitialBaseline1700000000000 } from "../../../backend/db/migrations/1700000000000-InitialBaseline";

describe("TypeORM Migrations Engine", () => {
  let ds: DataSource;

  beforeEach(async () => {
    ds = new DataSource({
      type: "better-sqlite3",
      database: ":memory:",
      migrations: [InitialBaseline1700000000000],
      synchronize: false,
    });
    await ds.initialize();
  });

  afterEach(async () => {
    if (ds?.isInitialized) {
      await ds.destroy();
    }
  });

  it("should successfully apply migrations and roll back cleanly", async () => {
    const executed = await ds.runMigrations();
    expect(executed).toBeDefined();
    expect(executed.length).toBeGreaterThan(0);

    // Verify tables exist in SQLite master
    const tables = await ds.query("SELECT name FROM sqlite_master WHERE type='table';");
    const tableNames = tables.map((t: any) => t.name);
    expect(tableNames).toContain("organizations");
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("leads");

    // Verify rollback capability
    await ds.undoLastMigration();
    const tablesAfterRollback = await ds.query("SELECT name FROM sqlite_master WHERE type='table';");
    const tableNamesAfter = tablesAfterRollback.map((t: any) => t.name);
    expect(tableNamesAfter).not.toContain("leads");
  });
});
