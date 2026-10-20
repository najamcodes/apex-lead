import { describe, it, expect } from "bun:test";
import * as core from "@sdk/core";
import { encrypt, decrypt, hashPassword, verifyPassword } from "@sdk/core/utils/crypto";
import { parseSpintax } from "@sdk/core/outreach/spintax";
import { calculateEnrichmentScore } from "@sdk/core/enrichment/waterfall-engine";
import { cleanAndParseJson } from "@sdk/core/ai/json-cleaner";

describe("@sdk/core Standalone SDK Extraction Verification", () => {
  it("should successfully import root entry point from @sdk/core", () => {
    expect(core).toBeDefined();
    expect(typeof core.encrypt).toBe("function");
    expect(typeof core.decrypt).toBe("function");
    expect(typeof core.parseSpintax).toBe("function");
    expect(typeof core.createStealthContext).toBe("function");
  });

  it("should encrypt and decrypt strings correctly via @sdk/core/utils/crypto", () => {
    const secret = "autonomous-lead-generation-2026";
    const encrypted = encrypt(secret);
    expect(encrypted).not.toBe(secret);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(secret);
  });

  it("should hash and verify passwords cleanly via @sdk/core/utils/crypto", () => {
    const password = "super-secure-password-123";
    const hash = hashPassword(password);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("should parse spintax strings correctly via @sdk/core/outreach/spintax", () => {
    const template = "{Hello|Hi|Greetings} world!";
    const parsed = parseSpintax(template);
    expect(["Hello world!", "Hi world!", "Greetings world!"]).toContain(parsed);
  });

  it("should calculate enrichment scores via @sdk/core/enrichment/waterfall-engine", () => {
    const score = calculateEnrichmentScore({
      hasValidMx: true,
      hasSsl: true,
      hasPhone: true,
      siteStatus: "ACTIVE"
    });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("should parse and sanitize JSON cleanly via @sdk/core/ai/json-cleaner", () => {
    const raw = "```json\n{\"score\": 95, \"verdict\": \"QUALIFIED\",}\n```";
    const cleaned = cleanAndParseJson<{ score: number; verdict: string }>(raw);
    expect(cleaned).toBeDefined();
    expect(cleaned?.score).toBe(95);
    expect(cleaned?.verdict).toBe("QUALIFIED");
  });

  it("should expose workflow graph engine from @sdk/core/engine", () => {
    expect(core.engine).toBeDefined();
    expect(typeof core.engine.GraphExecutor).toBe("function");
    expect(typeof core.engine.validateGraph).toBe("function");
    expect(typeof core.engine.detectCycle).toBe("function");

    const validGraph = {
      nodes: [
        { id: "node-1", type: "trigger_schedule", label: "Start", data: {}, position: { x: 0, y: 0 } },
        { id: "node-2", type: "action_scrape_gmaps", label: "Scrape", data: {}, position: { x: 100, y: 0 } }
      ],
      edges: [
        { id: "e1-2", source: "node-1", target: "node-2" }
      ]
    };

    expect(() => core.engine.validateGraph(validGraph)).not.toThrow();

    const hasCycle = core.engine.detectCycle(validGraph.nodes, validGraph.edges);
    expect(hasCycle).toBe(false);

    const cyclicGraph = {
      nodes: [
        { id: "node-1", type: "action_1", label: "N1", data: {}, position: { x: 0, y: 0 } },
        { id: "node-2", type: "action_2", label: "N2", data: {}, position: { x: 100, y: 0 } }
      ],
      edges: [
        { id: "e1-2", source: "node-1", target: "node-2" },
        { id: "e2-1", source: "node-2", target: "node-1" }
      ]
    };
    expect(() => core.engine.validateGraph(cyclicGraph)).toThrow();
  });

  it("should expose validation schemas from @sdk/core/validation", () => {
    expect(core.validation).toBeDefined();
    expect(core.validation.LeadInsertSchema).toBeDefined();
    expect(core.validation.ScraperStartSchema).toBeDefined();

    const validLead = {
      business_name: "Apex Studio",
      city: "Austin",
      country: "USA",
      email: "hello@apexstudio.io"
    };
    const result = core.validation.LeadInsertSchema.safeParse(validLead);
    expect(result.success).toBe(true);

    const invalidLead = {
      // missing business_name
      city: "Austin"
    };
    const invalidResult = core.validation.LeadInsertSchema.safeParse(invalidLead);
    expect(invalidResult.success).toBe(false);
  });

  it("should expose worker protocol and types from @sdk/core/worker", () => {
    expect(core.worker).toBeDefined();
    expect(core.worker.WORKER_MESSAGE_TYPES).toBeDefined();
    expect(typeof core.worker.createWorkerMessage).toBe("function");
    expect(typeof core.worker.isWorkerMessage).toBe("function");

    const msg = core.worker.createWorkerMessage({
      type: "worker:heartbeat",
      data: {
        workerId: "worker-xyz",
        activeJobs: 1,
        memoryUsage: 256
      }
    });

    expect(core.worker.isWorkerMessage(msg)).toBe(true);
    expect(msg.timestamp).toBeDefined();
    expect(core.worker.isWorkerMessage({ foo: "bar" })).toBe(false);
  });

  it("should expose storage abstraction from @sdk/core/storage", async () => {
    expect(core.storage).toBeDefined();
    expect(typeof core.storage.registerStorageProvider).toBe("function");
    expect(core.storage.leadStorage).toBeDefined();
    expect(core.storage.settingsStorage).toBeDefined();
    expect(core.storage.aiConnectionStorage).toBeDefined();

    // Register a mock provider to verify dependency injection
    let customLeadInserted = false;
    core.storage.registerStorageProvider({
      leads: {
        async insertLead(lead: any) {
          customLeadInserted = true;
          return { id: 999, ...lead };
        },
        async getAllLeads() { return []; },
        async getLeadById() { return null; },
        async updateLead() {},
      }
    });

    const inserted = await core.storage.leadStorage.insertLead({ business_name: "Test Corp" });
    expect(customLeadInserted).toBe(true);
    expect((inserted as any).id).toBe(999);
  });

  it("should expose plugin registry and types from @sdk/core/plugins", () => {
    expect(core.plugins).toBeDefined();
    expect(typeof core.plugins.initPluginRegistry).toBe("function");
    expect(typeof core.plugins.getPlugin).toBe("function");
    expect(typeof core.plugins.getAllPlugins).toBe("function");
    expect(typeof core.plugins.listPlugins).toBe("function");
  });
});
