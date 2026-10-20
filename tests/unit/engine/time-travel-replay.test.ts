import { describe, it, expect } from "bun:test";
import { ReplayEngine } from "../../../backend/engine/replay";

describe("DAG Time-Travel Replay & Snapshot Capture", () => {
  it("should capture and retrieve node execution snapshots", async () => {
    const replay = new ReplayEngine();
    const runId = "test-run-123";

    await replay.recordSnapshot({
      runId,
      nodeId: "node-scraper",
      status: "success",
      inputData: { query: "dentists" },
      outputData: [{ name: "Dental Care" }],
      durationMs: 120,
      timestamp: new Date().toISOString(),
    });

    const snapshots = await replay.getSnapshotsForRun(runId);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].outputData).toEqual([{ name: "Dental Care" }]);
  });
});
