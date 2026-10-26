import { describe, it, expect } from "bun:test";
import { checkDomainDeliverability } from "../../../plugins/built-in/enricher-dns-deliverability/dns-checker";
import dnsPlugin from "../../../plugins/built-in/enricher-dns-deliverability/index";
import { registerDnsNode } from "@sdk/backend/nodes/dns-node";
import { getNodeHandler } from "@sdk/backend/engine/registry";
import type { NodeExecutionContext } from "@sdk/backend/engine/types";

describe("DNS & Deliverability Enricher & Node", () => {
  it("should have valid enricher plugin metadata", () => {
    expect(dnsPlugin.id).toBe("enricher-dns-deliverability");
    expect(dnsPlugin.kind).toBe("enricher");
    expect(typeof dnsPlugin.enrich).toBe("function");
  });

  it("should parse domains correctly from URLs and emails", async () => {
    const res = await checkDomainDeliverability("user@google.com", true);
    expect(res.domain).toBe("google.com");
    expect(res.has_mx).toBe(true);
    expect(res.mx_records.length).toBeGreaterThan(0);
    expect(res.deliverability_score).toBeGreaterThanOrEqual(50);
  });

  it("should handle invalid or unresolvable domains gracefully", async () => {
    const res = await checkDomainDeliverability("nonexistent-domain-xyz-9876543210.org");
    expect(res.has_mx).toBe(false);
    expect(res.deliverability_score).toBe(0);
    expect(Array.isArray(res.errors)).toBe(true);
  });

  it("should execute DnsNode and route healthy vs risky leads", async () => {
    registerDnsNode();
    const handler = getNodeHandler("dns_check" as any);
    expect(handler).toBeDefined();

    const emitted: Record<string, any[]> = {};
    const mockCtx: NodeExecutionContext = {
      nodeId: "dns-1",
      runId: "run-dns-1",
      pipelineId: "p-dns-1",
      orgId: 1,
      config: {
        field: "email",
        min_score: 50,
        simulate: true,
      },
      input: {},
      incoming: [
        {
          id: "rec-valid",
          collection: "leads",
          data: {
            email: "contact@google.com",
            company_name: "Google Inc",
          },
          meta: {} as any,
        },
        {
          id: "rec-missing",
          collection: "leads",
          data: {
            company_name: "No Email Co",
          },
          meta: {} as any,
        },
      ],
      log: () => {},
      isCancelled: () => false,
      isPaused: async () => {},
      emit: (record, port = "main") => {
        if (!emitted[port]) emitted[port] = [];
        emitted[port].push(record);
      },
    };

    await handler.execute(mockCtx);

    expect(emitted["deliverable"]).toBeDefined();
    expect(emitted["deliverable"].length).toBe(1);
    expect(emitted["deliverable"][0].data.email).toBe("contact@google.com");
    expect(emitted["deliverable"][0].data.dns_deliverability.has_mx).toBe(true);

    expect(emitted["risky"]).toBeDefined();
    expect(emitted["risky"].length).toBe(1);
  });
});
