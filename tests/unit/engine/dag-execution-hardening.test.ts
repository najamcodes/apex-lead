import { describe, it, expect } from "bun:test";
import { GraphExecutor } from "../../../backend/engine/graph";
import type { DAGDefinition } from "../../../backend/engine/types";

describe("DAG Workflow Execution Engine Hardening", () => {
  it("should detect cyclical graphs and throw an error before running", () => {
    const cyclicGraph: DAGDefinition = {
      nodes: [
        { id: "1", type: "manualInputNode", data: {} },
        { id: "2", type: "filterConditionNode", data: {} },
      ],
      edges: [
        { id: "e1", source: "1", target: "2" },
        { id: "e2", source: "2", target: "1" },
      ],
    };

    const executor = new GraphExecutor(cyclicGraph);
    expect(() => executor.validate()).toThrow(/cycle/i);
  });

  it("should execute nodes in topological wave order", async () => {
    const executionOrder: string[] = [];

    const graph: DAGDefinition = {
      nodes: [
        { id: "A", type: "source", data: { onRun: () => executionOrder.push("A") } },
        { id: "B1", type: "step", data: { onRun: () => executionOrder.push("B1") } },
        { id: "B2", type: "step", data: { onRun: () => executionOrder.push("B2") } },
        { id: "C", type: "merge", data: { onRun: () => executionOrder.push("C") } },
      ],
      edges: [
        { id: "e1", source: "A", target: "B1" },
        { id: "e2", source: "A", target: "B2" },
        { id: "e3", source: "B1", target: "C" },
        { id: "e4", source: "B2", target: "C" },
      ],
    };

    const executor = new GraphExecutor(graph);
    await executor.run();

    expect(executionOrder[0]).toBe("A");
    expect(executionOrder[executionOrder.length - 1]).toBe("C");
    expect(executionOrder).toContain("B1");
    expect(executionOrder).toContain("B2");
  });
});
