import { describe, it, expect } from "bun:test";
import { app } from "../../../server/index";

describe("Katal Server Core API Route Verification", () => {
  it("should respond 200 on /health with healthy status", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.timestamp).toBeDefined();
  });

  it("should return 404 on /doc as OpenAPI docs are disabled", async () => {
    const res = await app.request("/doc");
    expect(res.status).toBe(404);
  });

  it("should return 404 on /swagger as Swagger docs are disabled", async () => {
    const res = await app.request("/swagger");
    expect(res.status).toBe(404);
  });

  it("should enforce authentication on protected /api/leads endpoint without token", async () => {
    const res = await app.request("/api/leads");
    expect(res.status).toBe(401);
  });
});
