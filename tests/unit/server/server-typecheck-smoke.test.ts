import { describe, it, expect } from "bun:test";

describe("Server TypeScript & Runtime Compilation Smoke Test", () => {
  it("should successfully import server router without TypeORM decorator errors", async () => {
    const { Application } = await import("katal");
    expect(Application).toBeDefined();

    // Verify entity decorators can be initialized in Bun
    const { LeadEntity } = await import("@sdk/core/db/entities/LeadEntity");
    expect(LeadEntity).toBeDefined();
    const lead = new LeadEntity();
    expect(lead).toBeInstanceOf(LeadEntity);
  });
});
