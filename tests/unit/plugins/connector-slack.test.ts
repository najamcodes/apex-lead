import { describe, it, expect } from "bun:test";
import { sendSlackAlert } from "@sdk/plugins/built-in/connector-slack/slack";
import slackPlugin from "@sdk/plugins/built-in/connector-slack/index";

describe("Slack Connector Plugin & Block Kit Alerts", () => {
  it("should have valid connector metadata", () => {
    expect(slackPlugin.id).toBe("connector-slack");
    expect(slackPlugin.name).toBe("Slack Alerts & Notifications");
    expect(slackPlugin.kind).toBe("connector");
    expect(typeof slackPlugin.push).toBe("function");
  });

  it("should fail gracefully when webhook URL is missing", async () => {
    const lead = {
      id: "lead-test-1",
      business_name: "Acme Corp",
      email: "alex@acme.com",
    };

    const res = await sendSlackAlert("", {
      trigger: "lead.approved",
      lead: lead as any,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Missing Slack Webhook URL");
  });

  it("should reject push execution when no webhook_url configured", async () => {
    const event = {
      trigger: "lead.approved",
      lead: { id: "lead-test-2", business_name: "Beta Ltd" },
    };

    let thrown = false;
    try {
      await slackPlugin.push(event as any, {});
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});
