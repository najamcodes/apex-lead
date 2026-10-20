import { describe, it, expect } from "bun:test";
import { existsSync } from "fs";
import { resolve } from "path";

describe("Next.js Web Edition Build Artifacts", () => {
  it("should have correct path mappings in web/tsconfig.json", async () => {
    const tsconfigFile = Bun.file("web/tsconfig.json");
    expect(await tsconfigFile.exists()).toBe(true);
    const tsconfig = await tsconfigFile.json();
    expect(tsconfig.compilerOptions.paths["@/*"]).toContain("../frontend/*");
  });

  it("should successfully reference existing screen components", () => {
    const screens = [
      "Dashboard",
      "Leads",
      "Scraper",
      "Review",
      "Outreach",
      "Pipelines",
      "Analytics",
      "Settings"
    ];

    for (const screen of screens) {
      const fullPath = resolve("frontend/screens", screen);
      expect(existsSync(fullPath)).toBe(true);
      expect(existsSync(resolve(fullPath, "index.tsx"))).toBe(true);
    }
  });
});
