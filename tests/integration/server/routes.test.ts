import { describe, it, expect } from "bun:test";
import { app } from "../../../server/index";

describe("Hono Server Core API Route Verification", () => {
  it("should respond 200 on /health with healthy status", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.timestamp).toBeDefined();
  });

  it("should respond 200 on /doc with valid OpenAPI specification", async () => {
    const res = await app.request("/doc");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toBeDefined();
    expect(body.info.title).toContain("LeadGen Desk");
  });

  it("should respond 200 on /swagger with HTML UI", async () => {
    const res = await app.request("/swagger");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<title>LeadGen Desk API</title>");
    expect(text).toContain("swagger-ui");
  });

  it("should enforce authentication on protected /api/leads endpoint without token", async () => {
    const res = await app.request("/api/leads");
    expect(res.status).toBe(401);
  });
});
