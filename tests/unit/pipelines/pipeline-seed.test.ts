import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";

describe("Pipeline Template Definitions & Seeder Validation", () => {
  const backendDefsDir = resolve(process.cwd(), "backend/pipelines/definitions");
  const sdkDefsDir = resolve(process.cwd(), "sdk/backend/pipelines/definitions");

  const expectedPipelines = [
    "lead-generation.json",
    "amazon-price-tracker.json",
    "inbound-reply-classifier.json",
    "hiring-velocity-intent.json",
    "competitor-tech-displacement.json",
    "preflight-email-deliverability.json",
    "ecommerce-price-watcher.json",
    "funding-pr-radar.json",
    "linkedin-abm-warmup.json",
    "autonomous-voice-sdr.json",
    "multi-source-dedupe-sync.json",
    "four-tier-decision-funnel.json",
    "human-approval-enterprise.json",
    "n8n-erp-sync-bridge.json",
    "contractor-cost-estimator.json",
    "b2b-clutch-agency-estimator.json",
    "yellowpages-local-dominance.json",
    "industrial-thomasnet-procurement.json",
    "venture-funded-scaleup-abm.json",
    "saas-competitor-g2-displacement.json",
  ];

  it("should have backend definitions directory with all 20 template JSON files", () => {
    expect(existsSync(backendDefsDir)).toBe(true);
    const files = readdirSync(backendDefsDir).filter(f => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(20);
    for (const expected of expectedPipelines) {
      expect(files).toContain(expected);
    }
  });

  it("should have sdk backend definitions directory with all 20 template JSON files", () => {
    expect(existsSync(sdkDefsDir)).toBe(true);
    const files = readdirSync(sdkDefsDir).filter(f => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(20);
    for (const expected of expectedPipelines) {
      expect(files).toContain(expected);
    }
  });

  for (const file of expectedPipelines) {
    it(`should parse ${file} cleanly and have valid DAG edges in both backend & sdk`, () => {
      for (const dir of [backendDefsDir, sdkDefsDir]) {
        const filePath = join(dir, file);
        expect(existsSync(filePath)).toBe(true);

        const raw = readFileSync(filePath, "utf8");
        const sanitized = raw
          .replace(/^\uFEFF/, "")
          .split("\n")
          .filter(l => !l.trim().startsWith("//"))
          .join("\n")
          .replace(/\/\*[\s\S]*?\*\//g, "");

        const parsed = JSON.parse(sanitized);

        expect(typeof parsed.id).toBe("string");
        expect(parsed.id.length).toBeGreaterThan(0);
        expect(typeof parsed.name).toBe("string");
        expect(parsed.nodes).toBeArray();
        expect(parsed.edges).toBeArray();
        expect(parsed.nodes.length).toBeGreaterThan(0);

        const nodeIds = new Set(parsed.nodes.map((n: any) => n.id));
        for (const node of parsed.nodes) {
          expect(typeof node.id).toBe("string");
          expect(typeof node.type).toBe("string");
          expect(typeof node.label).toBe("string");
          expect(typeof node.enabled).toBe("boolean");
          expect(typeof node.position).toBe("object");
          expect(typeof node.position.x).toBe("number");
          expect(typeof node.position.y).toBe("number");
        }

        for (const edge of parsed.edges) {
          expect(nodeIds.has(edge.from)).toBe(true);
          expect(nodeIds.has(edge.to)).toBe(true);
          if (edge.fromPort !== undefined) {
            expect(typeof edge.fromPort).toBe("string");
          }
        }
      }
    });
  }
});
