import { describe, it, expect } from "bun:test";

describe("Server TypeScript & Runtime Compilation Smoke Test", () => {
  it("should successfully import server router without TypeORM decorator errors", async () => {
    const { Hono } = await import("hono");
    expect(Hono).toBeDefined();

    // Verify entity decorators can be initialized in Bun
    const { LeadEntity } = await import("../../../backend/db/entities/LeadEntity");
    expect(LeadEntity).toBeDefined();
    const lead = new LeadEntity();
    expect(lead).toBeInstanceOf(LeadEntity);
  });
});
