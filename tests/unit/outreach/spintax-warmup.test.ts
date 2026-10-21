import { describe, it, expect } from "bun:test";
import { parseSpintax } from "@sdk/core/outreach/spintax";
import { calculateWarmupLimit } from "@sdk/core/outreach/warmup-engine";
import { replaceTemplateVars } from "@sdk/core/outreach/sequence-engine";

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

  it("should properly replace cold email sequence template variables", () => {
    const template = "Hello {{name}}, I noticed {{business_name}} in {{city}}. {{ai_hook}} Check {{website}}.";
    const result = replaceTemplateVars(template, {
      businessName: "Acme Plumbing",
      contactName: "John",
      city: "Austin",
      aiHook: "Loved your 5-star Google reviews!",
      website: "https://acmeplumbing.com"
    });

    expect(result).toBe("Hello John, I noticed Acme Plumbing in Austin. Loved your 5-star Google reviews! Check https://acmeplumbing.com.");

    // Fallback when contact name is omitted
    const fallbackResult = replaceTemplateVars("Hi {{name}} at {{business_name}}!", {
      businessName: "Apex Corp"
    });
    expect(fallbackResult).toBe("Hi there at Apex Corp!");
  });
});

