import { describe, it, expect } from "bun:test";
import * as backend from "@sdk/core";

describe("@sdk/core Standalone SDK Verification", () => {
  it("should successfully import root entry point from @sdk/core", () => {
    expect(backend).toBeDefined();
    expect(typeof backend.initDb).toBe("function");
    expect(typeof backend.getDataSource).toBe("function");
    expect(typeof backend.storeRecord).toBe("function");
    expect(typeof backend.registerBuiltInNodes).toBe("function");
    expect(typeof backend.seedDefaultPipelines).toBe("function");
    expect(backend.PIPELINE_TEMPLATES).toBeDefined();
  });

  it("should expose modular sub-namespaces on @sdk/core", () => {
    expect(backend.db).toBeDefined();
    expect(typeof backend.db.initDb).toBe("function");
    expect(typeof backend.db.getDataSource).toBe("function");

    expect(backend.collections).toBeDefined();
    expect(typeof backend.collections.storeRecord).toBe("function");
    expect(typeof backend.collections.queryCollection).toBe("function");

    expect(backend.nodes).toBeDefined();
    expect(typeof backend.nodes.registerBuiltInNodes).toBe("function");

    expect(backend.pipelines).toBeDefined();
    expect(typeof backend.pipelines.seedDefaultPipelines).toBe("function");

    expect(backend.templates).toBeDefined();
    expect(Array.isArray(backend.templates.PIPELINE_TEMPLATES)).toBe(true);
  });
});
