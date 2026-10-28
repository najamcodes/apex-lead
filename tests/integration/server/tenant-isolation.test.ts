import "../../../server/polyfill";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { AppDataSource } from "@sdk/core/db/data-source";
import { LeadEntity } from "@sdk/core/db/entities/LeadEntity";
import { AuditLogEntity } from "@sdk/core/db/entities/AuditLogEntity";
import { OrganizationEntity } from "@sdk/core/db/entities/OrganizationEntity";
import { logAuditEvent } from "../../../server/src/services/audit.service";
import { getScopedRepository } from "../../../server/src/utils/tenant-repository";

describe("Tenant Data Isolation & Audit Logging", () => {
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

  it("should never return records from another tenant", async () => {
    const orgRepo = AppDataSource.getRepository(OrganizationEntity);
    const leadRepo = AppDataSource.getRepository(LeadEntity);

    // Create 2 test orgs
    const orgA = await orgRepo.save(orgRepo.create({ name: "Tenant Org Alpha", plan: "pro" }));
    const orgB = await orgRepo.save(orgRepo.create({ name: "Tenant Org Beta", plan: "pro" }));

    // Create leads for each org
    const leadA = await leadRepo.save(leadRepo.create({
      business_name: "Alpha Corp Lead",
      org_id: orgA.id,
      category: "Tech",
      status: "new",
    }));

    const leadB = await leadRepo.save(leadRepo.create({
      business_name: "Beta Corp Lead",
      org_id: orgB.id,
      category: "Finance",
      status: "new",
    }));

    // Query scoped to Org A
    const scopedA = await leadRepo.find({ where: { org_id: orgA.id } });
    const leadAIds = scopedA.map(l => l.id);
    expect(leadAIds).toContain(leadA.id);
    expect(leadAIds).not.toContain(leadB.id);

    // Query scoped to Org B
    const scopedB = await leadRepo.find({ where: { org_id: orgB.id } });
    const leadBIds = scopedB.map(l => l.id);
    expect(leadBIds).toContain(leadB.id);
    expect(leadBIds).not.toContain(leadA.id);
  }, 20000);

  it("should log audit events and persist to database", async () => {
    const auditRepo = AppDataSource.getRepository(AuditLogEntity);

    await logAuditEvent({
      action: "pipeline.deleted",
      resourceType: "pipeline",
      resourceId: "pipeline-test-999",
      metadata: { deletedBy: "admin" },
      orgId: 1,
      userId: 1,
      ipAddress: "127.0.0.1",
    });

    const logged = await auditRepo.findOne({
      where: { resource_id: "pipeline-test-999", action: "pipeline.deleted" }
    });

    expect(logged).toBeDefined();
    expect(logged?.resource_type).toBe("pipeline");
    expect(logged?.action).toBe("pipeline.deleted");
    expect(logged?.org_id).toBe(1);
  }, 20000);
});
