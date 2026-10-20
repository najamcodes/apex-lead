import "../../../server/polyfill";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { AppDataSource } from "../../../backend/db/data-source";
import { LeadEntity } from "../../../backend/db/entities/LeadEntity";
import { OrganizationEntity } from "../../../backend/db/entities/OrganizationEntity";

describe("Database Seeder & Fixture Generation", () => {
  beforeEach(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  afterEach(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it("should find seeded organization and leads in the database", async () => {
    const orgRepo = AppDataSource.getRepository(OrganizationEntity);
    const leadRepo = AppDataSource.getRepository(LeadEntity);

    const org = await orgRepo.findOne({ where: { name: "Acme Growth Labs" } });
    expect(org).toBeDefined();

    const leadCount = await leadRepo.count();
    expect(leadCount).toBeGreaterThanOrEqual(10);
  });
});
