import { describe, it, expect } from "bun:test";
import { registerCostEstimatorNode } from "@sdk/backend/nodes/cost-estimator-node";
import { registerDirectoryScraperNode } from "@sdk/backend/nodes/directory-scraper-node";
import { getNodeHandler, getNodeTypeDescriptor } from "@sdk/backend/engine/registry";
import type { NodeExecutionContext } from "@sdk/backend/engine/types";

describe("CostEstimatorNode & DirectoryScraperNode Test Suite", () => {
  describe("CostEstimatorNode registration and execution", () => {
    registerCostEstimatorNode();

    it("should be properly registered in the engine registry", () => {
      const handler = getNodeHandler("cost_estimator" as any);
      const descriptor = getNodeTypeDescriptor("cost_estimator" as any);

      expect(handler).toBeDefined();
      expect(descriptor).toBeDefined();
      expect(descriptor?.category).toBe("Process");
      expect(descriptor?.outputs.map((o) => o.id)).toEqual([
        "high_ticket",
        "mid_market",
        "smb",
        "main",
      ]);
    });

    it("should classify High Ticket, Mid-Market, and SMB leads and route to corresponding ports", async () => {
      const handler = getNodeHandler("cost_estimator" as any)!;

      const incomingRecords = [
        {
          id: "rec-1",
          collection: "leads",
          data: {
            business_name: "Apex Commercial Roofing",
            trade: "Roofing",
            estimated_avg_job_cost: 32000,
            review_count: 45,
            licensed: true,
            website_url: "https://apexcommercial.com",
          },
          meta: { pipelineId: "p1", runId: "r1", orgId: 1, sourceNodeId: "n0", createdAt: "", trace: [] },
        },
        {
          id: "rec-2",
          collection: "leads",
          data: {
            business_name: "Suburban HVAC Solutions",
            trade: "HVAC",
            estimated_avg_job_cost: 8500,
            review_count: 20,
            website_url: "https://suburbanhvac.com",
          },
          meta: { pipelineId: "p1", runId: "r1", orgId: 1, sourceNodeId: "n0", createdAt: "", trace: [] },
        },
        {
          id: "rec-3",
          collection: "leads",
          data: {
            business_name: "Quick Drain Plumbing",
            trade: "Plumbing",
            estimated_avg_job_cost: 1800,
            review_count: 5,
          },
          meta: { pipelineId: "p1", runId: "r1", orgId: 1, sourceNodeId: "n0", createdAt: "", trace: [] },
        },
      ];

      const emitted: Record<string, any[]> = {
        high_ticket: [],
        mid_market: [],
        smb: [],
        main: [],
      };

      const ctx: NodeExecutionContext = {
        nodeId: "est-1",
        runId: "run-est",
        pipelineId: "pipe-est",
        orgId: 1,
        config: {
          high_ticket_threshold: 20000,
          mid_market_threshold: 5000,
          project_size_field: "estimated_avg_job_cost",
          trade_multiplier: 1.0,
          annual_ltv_multiplier: 1.5,
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

      // Verify port routing
      expect(emitted.high_ticket.length).toBe(1);
      expect(emitted.high_ticket[0].data.business_name).toBe("Apex Commercial Roofing");
      expect(emitted.high_ticket[0].data.lead_budget_tier).toBe("High Ticket");
      expect(emitted.high_ticket[0].data.deal_size).toBe(32000);
      expect(emitted.high_ticket[0].data.cost_estimation.estimated_annual_ltv).toBe(48000);

      expect(emitted.mid_market.length).toBe(1);
      expect(emitted.mid_market[0].data.business_name).toBe("Suburban HVAC Solutions");
      expect(emitted.mid_market[0].data.lead_budget_tier).toBe("Mid-Market");
      expect(emitted.mid_market[0].data.deal_size).toBe(8500);

      expect(emitted.smb.length).toBe(1);
      expect(emitted.smb[0].data.business_name).toBe("Quick Drain Plumbing");
      expect(emitted.smb[0].data.lead_budget_tier).toBe("SMB");
      expect(emitted.smb[0].data.deal_size).toBe(1800);

      // All 3 records emitted to main
      expect(emitted.main.length).toBe(3);
    });

    it("should calculate multiplier adjustments and confidence scores accurately", async () => {
      const handler = getNodeHandler("cost_estimator" as any)!;

      const incomingRecord = {
        id: "rec-multi",
        collection: "leads",
        data: {
          business_name: "Metro Solar Grid",
          min_project_size: 20000,
          licensed: true,
          verification_status: "Verified",
          review_count: 50,
          website_url: "https://metrosolar.com",
        },
        meta: { pipelineId: "p1", runId: "r1", orgId: 1, sourceNodeId: "n0", createdAt: "", trace: [] },
      };

      const emitted: Record<string, any[]> = {
        high_ticket: [],
        mid_market: [],
        smb: [],
        main: [],
      };

      const ctx: NodeExecutionContext = {
        nodeId: "est-2",
        runId: "run-est-2",
        pipelineId: "pipe-est-2",
        orgId: 1,
        config: {
          high_ticket_threshold: 25000,
          mid_market_threshold: 5000,
          project_size_field: "min_project_size",
          trade_multiplier: 1.5, // 20,000 * 1.5 = 30,000
          annual_ltv_multiplier: 2.0, // 30,000 * 2.0 = 60,000
        },
        input: {},
        incoming: [incomingRecord as any],
        emit: (rec, port = "main") => {
          if (!emitted[port]) emitted[port] = [];
          emitted[port].push(rec);
        },
        log: () => {},
        isCancelled: () => false,
        isPaused: async () => {},
      };

      await handler.execute(ctx);

      expect(emitted.high_ticket.length).toBe(1);
      const est = emitted.high_ticket[0].data.cost_estimation;
      expect(est.estimated_job_value).toBe(30000);
      expect(est.estimated_annual_ltv).toBe(60000);
      expect(est.budget_tier).toBe("High Ticket");
      expect(est.confidence_score).toBeGreaterThanOrEqual(80);
    });
  });

  describe("DirectoryScraperNode registration and execution", () => {
    registerDirectoryScraperNode();

    it("should be properly registered as a Source node", () => {
      const handler = getNodeHandler("directory_scraper" as any);
      const descriptor = getNodeTypeDescriptor("directory_scraper" as any);

      expect(handler).toBeDefined();
      expect(descriptor).toBeDefined();
      expect(descriptor?.category).toBe("Source");
      expect(descriptor?.isStart).toBe(true);
      expect(descriptor?.produces).toBe(true);
    });

    it("should scrape YellowPages directory listings in simulated mode", async () => {
      const handler = getNodeHandler("directory_scraper" as any)!;
      const records: any[] = [];

      const ctx: NodeExecutionContext = {
        nodeId: "ds-yp",
        runId: "run-yp",
        pipelineId: "pipe-yp",
        orgId: 1,
        config: {
          directory: "yellowpages",
          category: "HVAC Contractors",
          city: "Atlanta, GA",
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
      expect(first.collection).toBe("leads");
      expect(first.data.source).toBe("yellowpages");
      expect(first.data.years_in_business).toBeGreaterThan(0);
      expect(first.meta.pipelineId).toBe("pipe-yp");
    });

    it("should scrape Clutch directory listings in simulated mode", async () => {
      const handler = getNodeHandler("directory_scraper" as any)!;
      const records: any[] = [];

      const ctx: NodeExecutionContext = {
        nodeId: "ds-clutch",
        runId: "run-clutch",
        pipelineId: "pipe-clutch",
        orgId: 1,
        config: {
          directory: "clutch",
          category: "Mobile App Development",
          city: "New York, NY",
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
      expect(first.data.source).toBe("clutch");
      expect(first.data.min_project_size).toBeGreaterThanOrEqual(10000);
      expect(first.data.verification_status).toBe("Verified");
    });

    it("should scrape Contractor Estimator listings in simulated mode", async () => {
      const handler = getNodeHandler("directory_scraper" as any)!;
      const records: any[] = [];

      const ctx: NodeExecutionContext = {
        nodeId: "ds-contractor",
        runId: "run-contractor",
        pipelineId: "pipe-contractor",
        orgId: 1,
        config: {
          directory: "contractor_estimator",
          category: "Roofing",
          city: "Denver, CO",
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
      expect(first.data.source).toBe("contractor_estimator");
      expect(first.data.trade).toBe("Roofing");
      expect(first.data.estimated_avg_job_cost).toBeGreaterThan(5000);
      expect(first.data.licensed).toBe(true);
    });
  });
});
