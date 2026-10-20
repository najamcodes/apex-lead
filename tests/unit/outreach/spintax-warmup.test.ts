import { describe, it, expect } from "bun:test";
import { parseSpintax } from "@sdk/core/outreach/spintax";
import { calculateWarmupLimit } from "@sdk/core/outreach/warmup-engine";

describe("Spintax Parser & Warmup Engine", () => {
  it("should resolve single and deeply nested spintax templates", () => {
    const template = "{Hi|{Hey|Greetings}} {there|friend}!";
    const result = parseSpintax(template);

    expect(result).not.toContain("{");
    expect(result).not.toContain("}");
    expect(result).not.toContain("|");
    expect(result.endsWith("!")).toBe(true);
  });

  it("should calculate progressive warmup limits correctly", () => {
    const day1Limit = calculateWarmupLimit({ daysActive: 0, startLimit: 5, rampPerDay: 3, maxLimit: 50 });
    expect(day1Limit).toBe(5);

    const day5Limit = calculateWarmupLimit({ daysActive: 5, startLimit: 5, rampPerDay: 3, maxLimit: 50 });
    expect(day5Limit).toBe(20);

    const day30Limit = calculateWarmupLimit({ daysActive: 30, startLimit: 5, rampPerDay: 3, maxLimit: 50 });
    expect(day30Limit).toBe(50);
  });
});
