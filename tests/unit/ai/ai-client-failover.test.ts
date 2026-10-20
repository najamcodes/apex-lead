import { describe, it, expect } from "bun:test";
import { cleanAndParseJson } from "@sdk/core/ai/json-cleaner";

describe("AI Response Sanitization & JSON Cleaner", () => {
  it("should extract valid JSON from markdown code fences", () => {
    const rawLLMOutput = "Here is the response:\n```json\n{\n  \"subject\": \"Quick question\",\n  \"score\": 95\n}\n```";
    const parsed = cleanAndParseJson(rawLLMOutput);
    expect(parsed).toEqual({ subject: "Quick question", score: 95 });
  });

  it("should repair JSON with trailing commas", () => {
    const malformed = '{"company": "Apex", "tags": ["B2B", "SaaS",],}';
    const parsed = cleanAndParseJson(malformed);
    expect(parsed).toEqual({ company: "Apex", tags: ["B2B", "SaaS"] });
  });
});
