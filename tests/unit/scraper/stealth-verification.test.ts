import { describe, it, expect } from "bun:test";
import { applyStealthScripts } from "@sdk/core/scraper/stealth";

describe("Playwright Stealth & Evasion Verification", () => {
  it("should register init script with context and apply stealth properties", async () => {
    let registeredFn: any = null;
    let registeredArg: any = null;
    const mockContext: any = {
      addInitScript: async (fn: any, arg: any) => {
        registeredFn = fn;
        registeredArg = arg;
      }
    };

    await applyStealthScripts(mockContext);
    expect(registeredFn).toBeDefined();
    expect(typeof registeredFn).toBe("function");
    expect(registeredArg).toBeDefined();
    expect(registeredArg.userAgent).toBeDefined();
    expect(registeredArg.viewport).toBeDefined();

    // Verify evasions inside the init script
    const scriptString = registeredFn.toString();
    expect(scriptString).toContain("webdriver");
    expect(scriptString).toContain("languages");
    expect(scriptString).toContain("webGLVendor");
    expect(scriptString).toContain("webGLRenderer");
    expect(scriptString).toContain("deviceMemory");
    expect(scriptString).toContain("hardwareConcurrency");
  });
});
