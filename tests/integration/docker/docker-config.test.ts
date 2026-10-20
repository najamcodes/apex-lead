import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("Docker & Compose Configuration Validation", () => {
  const rootDir = process.cwd();

  it("should have Dockerfile.server with correct base, dependencies, and healthcheck", () => {
    const serverDockerPath = join(rootDir, "Dockerfile.server");
    expect(existsSync(serverDockerPath)).toBe(true);
    const content = readFileSync(serverDockerPath, "utf-8");
    expect(content).toContain("oven/bun");
    expect(content).toContain("HEALTHCHECK");
    expect(content).toContain("4000");
    expect(content).toContain("server/index.ts");
  });

  it("should have Dockerfile.web with multi-stage build and runner", () => {
    const webDockerPath = join(rootDir, "Dockerfile.web");
    expect(existsSync(webDockerPath)).toBe(true);
    const content = readFileSync(webDockerPath, "utf-8");
    expect(content).toContain("AS deps");
    expect(content).toContain("AS builder");
    expect(content).toContain("AS runner");
    expect(content).toContain("build:web");
    expect(content).toContain("start:web");
  });

  it("should declare services, healthchecks, and persistent volumes in docker-compose.yml", () => {
    const composePath = join(rootDir, "docker-compose.yml");
    expect(existsSync(composePath)).toBe(true);
    const composeContent = readFileSync(composePath, "utf-8");
    expect(composeContent).toContain("healthcheck");
    expect(composeContent).toContain("apexlead-server");
    expect(composeContent).toContain("apexlead-web");
    expect(composeContent).toContain("apexlead-db");
    expect(composeContent).toContain("apexlead-redis");
    expect(composeContent).toContain("JWT_SECRET");
    expect(composeContent).toContain("4000");
    expect(composeContent).toContain("3000");
    expect(composeContent).toContain("service_healthy");
  });
});
