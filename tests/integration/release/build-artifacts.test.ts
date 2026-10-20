import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync } from "fs";

describe("Production Release Configuration & Assets", () => {
  it("should have valid electron-builder configuration", () => {
    expect(existsSync("electron-builder.yml")).toBe(true);
    const content = readFileSync("electron-builder.yml", "utf-8");
    expect(content).toContain("appId: com.apexlead.app");
    expect(content).toContain("productName: ApexLead");
    expect(content).toContain("win:");
    expect(content).toContain("nsis:");
  });

  it("should have application icons prepared", () => {
    expect(existsSync("build/icon.ico") || existsSync("resources/icon.ico")).toBe(true);
    expect(existsSync("build/icon.png") || existsSync("resources/icon.png")).toBe(true);
  });

  it("should declare valid package name, version and build scripts in package.json", async () => {
    const pkg = await Bun.file("package.json").json();
    expect(pkg.name).toBe("apexlead");
    expect(pkg.version).toBeDefined();
    expect(pkg.scripts["build:electron"]).toBeDefined();
    expect(pkg.scripts["build:server"]).toBeDefined();
    expect(pkg.scripts["build:web"]).toBeDefined();
  });

  it("should have GitHub Actions CI workflow declared", () => {
    expect(existsSync(".github/workflows/ci.yml")).toBe(true);
    const ciContent = readFileSync(".github/workflows/ci.yml", "utf-8");
    expect(ciContent).toContain("ApexLead CI");
    expect(ciContent).toContain("npm test");
  });
});
