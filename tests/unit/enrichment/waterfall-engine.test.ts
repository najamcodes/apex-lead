import { describe, it, expect } from "bun:test";
import { verifyMxRecords } from "@sdk/core/enrichment/mx-verifier";
import { calculateEnrichmentScore } from "@sdk/core/enrichment/waterfall-engine";

describe("Enrichment Verification & Waterfall Scoring", () => {
  it("should successfully verify MX records for valid domains", async () => {
    const result = await verifyMxRecords("gmail.com");
    expect(result.hasMx).toBe(true);
    expect(result.exchanges.length).toBeGreaterThan(0);
  });

  it("should reject non-existent domains", async () => {
    const result = await verifyMxRecords("non-existent-domain-xyz-987.invalid");
    expect(result.hasMx).toBe(false);
  });

  it("should calculate correct confidence scores", () => {
    const score = calculateEnrichmentScore({
      hasMx: true,
      providerConfidence: 85,
      isRoleAccount: false,
      isDisposable: false,
    });
    expect(score).toBeGreaterThanOrEqual(80);
  });
});
