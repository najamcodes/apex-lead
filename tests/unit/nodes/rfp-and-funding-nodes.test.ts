import { describe, it, expect } from "bun:test";
import { registerRfpEstimatorNode } from "@sdk/backend/nodes/rfp-estimator-node";
import { registerFundingIntentNode } from "@sdk/backend/nodes/funding-intent-node";
import { registerDirectoryScraperNode } from "@sdk/backend/nodes/directory-scraper-node";
import { getNodeHandler, getNodeTypeDescriptor } from "@sdk/backend/engine/registry";
import type { NodeExecutionContext } from "@sdk/backend/engine/types";

describe("RfpEstimatorNode & FundingIntentNode Test Suite", () => {
  describe("RfpEstimatorNode registration and execution", () => {
    registerRfpEstimatorNode();

    it("should be properly registered in the engine registry", () => {
      const handler = getNodeHandler("rfp_estimator" as any);
      const descriptor = getNodeTypeDescriptor("rfp_estimator" as any);

      expect(handler).toBeDefined();
      expect(descriptor).toBeDefined();
      expect(descriptor?.category).toBe("Process");
      expect(descriptor?.outputs.map((o) => o.id)).toEqual([
        "tier_1_prime",
        "tier_2_sub",
        "tier_3_specialist",
        "main",
      ]);
    });

    it("should classify suppliers into Tier 1 Prime, Tier 2 Subcontractor, and Tier 3 Specialist", async () => {
      const handler = getNodeHandler("rfp_estimator" as any)!;

      const incomingRecords = [
        {
          id: "mfg-1",
          collection: "leads",
          data: {
            business_name: "Apex Aerospace Machining",
            estimated_annual_revenue: 35000000,
            certifications: ["ISO 9001:2015", "AS9100D", "ITAR Registered"],
            rfq_enabled: true,
            website_url: "https://apexmachining.com",
          },
          meta: { pipelineId: "p1", runId: "r1", orgId: 1, sourceNodeId: "n0", createdAt: "", trace: [] },
        },
        {
          id: "mfg-2",
          collection: "leads",
          data: {
            business_name: "Midwest Die & Stamping",
            estimated_annual_revenue: 1200000,
            certifications: ["ISO 9001:2015"],
            rfq_enabled: true,
            website_url: "https://midweststamping.com",
          },
          meta: { pipelineId: "p1", runId: "r1", orgId: 1, sourceNodeId: "n0", createdAt: "", trace: [] },
        },
        {
          id: "mfg-3",
          collection: "leads",
          data: {
            business_name: "Local Prototyping Shop",
            estimated_annual_revenue: 250000,
            certifications: [],
          },
          meta: { pipelineId: "p1", runId: "r1", orgId: 1, sourceNodeId: "n0", createdAt: "", trace: [] },
        },
      ];

      const emitted: Record<string, any[]> = {
        tier_1_prime: [],
        tier_2_sub: [],
        tier_3_specialist: [],
        main: [],
      };

      const ctx: NodeExecutionContext = {
        nodeId: "rfp-1",
        runId: "run-rfp",
        pipelineId: "pipe-rfp",
        orgId: 1,
        config: {
          prime_threshold: 500000,
          sub_threshold: 100000,
          revenue_field: "estimated_annual_revenue",
          max_single_bid_ratio: 0.25,
          require_iso_or_itar: true,
        },
        input: {},
        incoming: incomingRecords as any,
        emit: (rec, port = "main") => {
          if (!emitted[port]) emitted[port] = [];
          emitted[port].push(rec);
        },
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
      };

      await handler.execute(ctx);

      // Verify routing
      expect(emitted.tier_1_prime.length).toBe(1);
      expect(emitted.tier_1_prime[0].data.business_name).toBe("Apex Aerospace Machining");
      expect(emitted.tier_1_prime[0].data.procurement_tier).toBe("Tier 1 Prime");
      expect(emitted.tier_1_prime[0].data.rfp_estimation.estimated_rfp_capacity).toBe(8750000);
      expect(emitted.tier_1_prime[0].data.rfp_estimation.compliance_score).toBeGreaterThanOrEqual(90);

      expect(emitted.tier_2_sub.length).toBe(1);
      expect(emitted.tier_2_sub[0].data.business_name).toBe("Midwest Die & Stamping");
      expect(emitted.tier_2_sub[0].data.procurement_tier).toBe("Tier 2 Subcontractor");
      expect(emitted.tier_2_sub[0].data.rfp_estimation.estimated_rfp_capacity).toBe(300000);

      expect(emitted.tier_3_specialist.length).toBe(1);
      expect(emitted.tier_3_specialist[0].data.business_name).toBe("Local Prototyping Shop");
      expect(emitted.tier_3_specialist[0].data.procurement_tier).toBe("Tier 3 Specialist");

      expect(emitted.main.length).toBe(3);
    });
  });

  describe("FundingIntentNode registration and execution", () => {
    registerFundingIntentNode();

    it("should be properly registered in the engine registry", () => {
      const handler = getNodeHandler("funding_intent" as any);
      const descriptor = getNodeTypeDescriptor("funding_intent" as any);

      expect(handler).toBeDefined();
      expect(descriptor).toBeDefined();
      expect(descriptor?.category).toBe("Process");
      expect(descriptor?.outputs.map((o) => o.id)).toEqual([
        "immediate_expansion",
        "growth_scale",
        "mature_nurture",
        "main",
      ]);
    });

    it("should evaluate capital deployment urgency and estimated software budgets", async () => {
      const handler = getNodeHandler("funding_intent" as any)!;

      const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const midDate = new Date(Date.now() - 240 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const oldDate = new Date(Date.now() - 600 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const incomingRecords = [
        {
          id: "startup-1",
          collection: "leads",
          data: {
            business_name: "Synthetix AI",
            last_funding_type: "Series B",
            last_funding_amount_usd: 30000000,
            total_funding_usd: 45000000,
            last_funding_date: recentDate,
          },
          meta: { pipelineId: "p1", runId: "r1", orgId: 1, sourceNodeId: "n0", createdAt: "", trace: [] },
        },
        {
          id: "startup-2",
          collection: "leads",
          data: {
            business_name: "DataWeave Systems",
            last_funding_type: "Series A",
            last_funding_amount_usd: 12000000,
            total_funding_usd: 15000000,
            last_funding_date: midDate,
          },
          meta: { pipelineId: "p1", runId: "r1", orgId: 1, sourceNodeId: "n0", createdAt: "", trace: [] },
        },
        {
          id: "startup-3",
          collection: "leads",
          data: {
            business_name: "Legacy Tech Corp",
            last_funding_type: "Seed",
            last_funding_amount_usd: 2000000,
            total_funding_usd: 2000000,
            last_funding_date: oldDate,
          },
          meta: { pipelineId: "p1", runId: "r1", orgId: 1, sourceNodeId: "n0", createdAt: "", trace: [] },
        },
      ];

      const emitted: Record<string, any[]> = {
        immediate_expansion: [],
        growth_scale: [],
        mature_nurture: [],
        main: [],
      };

      const ctx: NodeExecutionContext = {
        nodeId: "fund-1",
        runId: "run-fund",
        pipelineId: "pipe-fund",
        orgId: 1,
        config: {
          min_funding_threshold: 5000000,
          budget_allocation_pct: 10,
          freshness_days_immediate: 180,
        },
        input: {},
        incoming: incomingRecords as any,
        emit: (rec, port = "main") => {
          if (!emitted[port]) emitted[port] = [];
          emitted[port].push(rec);
        },
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
      };

      await handler.execute(ctx);

      expect(emitted.immediate_expansion.length).toBe(1);
      const s1 = emitted.immediate_expansion[0].data;
      expect(s1.business_name).toBe("Synthetix AI");
      expect(s1.capital_deployment_status).toBe("Immediate Expansion");
      expect(s1.funding_intent.estimated_software_agency_budget).toBe(3000000); // 10% of $30M
      expect(s1.funding_intent.capital_urgency_score).toBeGreaterThanOrEqual(80);

      expect(emitted.growth_scale.length).toBe(1);
      const s2 = emitted.growth_scale[0].data;
      expect(s2.business_name).toBe("DataWeave Systems");
      expect(s2.capital_deployment_status).toBe("Active Growth Scale");

      expect(emitted.mature_nurture.length).toBe(1);
      const s3 = emitted.mature_nurture[0].data;
      expect(s3.business_name).toBe("Legacy Tech Corp");
      expect(s3.capital_deployment_status).toBe("Mature Nurture");

      expect(emitted.main.length).toBe(3);
    });
  });

  describe("DirectoryScraperNode expanded sources", () => {
    registerDirectoryScraperNode();

    it("should scrape ThomasNet listings in simulated mode", async () => {
      const handler = getNodeHandler("directory_scraper" as any)!;
      const records: any[] = [];

      const ctx: NodeExecutionContext = {
        nodeId: "ds-thomas",
        runId: "run-thomas",
        pipelineId: "pipe-thomas",
        orgId: 1,
        config: {
          directory: "thomasnet",
          category: "CNC Machining",
          city: "Cleveland, OH",
          max_results: 3,
          simulate: true,
        },
        input: {},
        incoming: [],
        emit: (rec) => {
          records.push(rec);
        },
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
      };

      await handler.execute(ctx);

      expect(records.length).toBe(3);
      const first = records[0];
      expect(first.data.source).toBe("thomasnet");
      expect(first.data.estimated_annual_revenue).toBeGreaterThanOrEqual(1000000);
      expect(first.data.certifications).toBeArray();
    });

    it("should scrape Crunchbase listings in simulated mode", async () => {
      const handler = getNodeHandler("directory_scraper" as any)!;
      const records: any[] = [];

      const ctx: NodeExecutionContext = {
        nodeId: "ds-crunch",
        runId: "run-crunch",
        pipelineId: "pipe-crunch",
        orgId: 1,
        config: {
          directory: "crunchbase",
          category: "Artificial Intelligence",
          city: "San Francisco, CA",
          max_results: 3,
          simulate: true,
        },
        input: {},
        incoming: [],
        emit: (rec) => {
          records.push(rec);
        },
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
      };

      await handler.execute(ctx);

      expect(records.length).toBe(3);
      const first = records[0];
      expect(first.data.source).toBe("crunchbase");
      expect(first.data.total_funding_usd).toBeGreaterThanOrEqual(3000000);
      expect(first.data.lead_investors).toBeArray();
    });

    it("should scrape G2 software listings in simulated mode", async () => {
      const handler = getNodeHandler("directory_scraper" as any)!;
      const records: any[] = [];

      const ctx: NodeExecutionContext = {
        nodeId: "ds-g2",
        runId: "run-g2",
        pipelineId: "pipe-g2",
        orgId: 1,
        config: {
          directory: "g2",
          category: "CRM Software",
          city: "",
          max_results: 3,
          simulate: true,
        },
        input: {},
        incoming: [],
        emit: (rec) => {
          records.push(rec);
        },
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
      };

      await handler.execute(ctx);

      expect(records.length).toBe(3);
      const first = records[0];
      expect(first.data.source).toBe("g2");
      expect(first.data.product_name).toBeDefined();
      expect(first.data.g2_rating).toBeGreaterThan(4.0);
    });
  });
});
