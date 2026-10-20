import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";

describe("Pipeline Template Definitions & Seeder Validation", () => {
  const definitionsDir = resolve(process.cwd(), "backend/pipelines/definitions");

  it("should have definitions directory with valid template JSON files", () => {
    expect(existsSync(definitionsDir)).toBe(true);
    const files = readdirSync(definitionsDir).filter(f => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files).toContain("lead-generation.json");
    expect(files).toContain("amazon-price-tracker.json");
  });

  it("should parse lead-generation.json cleanly and have valid DAG edges", () => {
    const raw = readFileSync(join(definitionsDir, "lead-generation.json"), "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
    const parsed = JSON.parse(sanitized);

    expect(parsed.id).toBe("lead-generation");
    expect(parsed.nodes).toBeArray();
    expect(parsed.edges).toBeArray();

    const nodeIds = new Set(parsed.nodes.map((n: any) => n.id));
    for (const edge of parsed.edges) {
      expect(nodeIds.has(edge.from)).toBe(true);
      expect(nodeIds.has(edge.to)).toBe(true);
    }
  });

  it("should parse amazon-price-tracker.json cleanly and have valid DAG edges", () => {
    const raw = readFileSync(join(definitionsDir, "amazon-price-tracker.json"), "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
    const parsed = JSON.parse(sanitized);

    expect(parsed.id).toBe("amazon-price-tracker");
    expect(parsed.nodes).toBeArray();
    expect(parsed.edges).toBeArray();

    const nodeIds = new Set(parsed.nodes.map((n: any) => n.id));
    for (const edge of parsed.edges) {
      expect(nodeIds.has(edge.from)).toBe(true);
      expect(nodeIds.has(edge.to)).toBe(true);
    }
  });
});
