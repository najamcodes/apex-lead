import { describe, it, expect } from "bun:test";
import { evaluateTemplateExpression } from "@sdk/core/engine/transformer";

describe("Expression Transformer & Interpolation Engine", () => {
  it("should interpolate simple and nested object properties", () => {
    const scope = {
      lead: {
        firstName: "Alexander",
        company: { name: "Apex Global", domain: "apex.io" },
      },
    };

    const template = "Hi {{lead.firstName}}, does {{lead.company.name}} need leads?";
    const result = evaluateTemplateExpression(template, scope);
    expect(result).toBe("Hi Alexander, does Apex Global need leads?");
  });

  it("should safely handle null or missing fields with fallbacks", () => {
    const scope = { lead: { firstName: "Emily" } };
    const template = "Welcome to {{lead.company.name || 'your organization'}}";
    const result = evaluateTemplateExpression(template, scope);
    expect(result).toBe("Welcome to your organization");
  });

  it("should support pipe filters like uppercase and lowercase", () => {
    const scope = {
      city: "San Francisco",
      tag: "vip",
    };
    const template = "{{city | uppercase}} - {{tag | uppercase}}";
    const result = evaluateTemplateExpression(template, scope);
    expect(result).toBe("SAN FRANCISCO - VIP");
  });
});
