import { describe, it, expect } from "bun:test";
import { IPC } from "../../../shared/types";

describe("IPC Protocol & Channel Parity", () => {
  it("should have all defined IPC channels as non-empty strings", () => {
    const channels = Object.values(IPC);
    expect(channels.length).toBeGreaterThanOrEqual(65);
    for (const channel of channels) {
      expect(typeof channel).toBe("string");
      expect(channel.length).toBeGreaterThan(0);
    }
  });

  it("should include critical communication channels", () => {
    expect(IPC.LEADS_GET_ALL).toBeDefined();
    expect(IPC.SCRAPER_START).toBeDefined();
    expect(IPC.OUTREACH_SEND).toBeDefined();
    expect(IPC.PIPELINE_RUN_NOW).toBeDefined();
    expect(IPC.PIPELINE_GET_STATUS).toBeDefined();
    expect(IPC.PLUGINS_GET_ALL).toBeDefined();
    expect(IPC.SETTINGS_GET).toBeDefined();
  });
});
