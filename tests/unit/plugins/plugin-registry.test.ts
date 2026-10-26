import { describe, it, expect, beforeAll } from "bun:test";
import { initPluginRegistry, listPlugins, getPlugin } from "../../../plugins/registry";

describe("Plugin Registry & Discovery Engine", () => {
  beforeAll(async () => {
    await initPluginRegistry();
  });

  it("should discover and register all built-in plugins cleanly", () => {
    const plugins = listPlugins();
    expect(plugins.length).toBe(15);

    const pluginIds = plugins.map(p => p.manifest.id);
    expect(pluginIds).toContain("google-maps");
    expect(pluginIds).toContain("scraper-yellowpages");
    expect(pluginIds).toContain("scraper-clutch");
    expect(pluginIds).toContain("scraper-contractor-estimator");
    expect(pluginIds).toContain("scraper-thomasnet");
    expect(pluginIds).toContain("scraper-crunchbase");
    expect(pluginIds).toContain("scraper-g2");
    expect(pluginIds).toContain("enricher-hunter");
    expect(pluginIds).toContain("enricher-pagespeed");
    expect(pluginIds).toContain("enricher-ssl");
    expect(pluginIds).toContain("enricher-ai-decision-maker");
    expect(pluginIds).toContain("enricher-dns-deliverability");
    expect(pluginIds).toContain("connector-webhook");
    expect(pluginIds).toContain("connector-discord");
    expect(pluginIds).toContain("connector-slack");
  });

  it("should retrieve a registered plugin by ID and verify default enablement", () => {
    const gmaps = getPlugin("google-maps");
    expect(gmaps).toBeDefined();
    expect(gmaps?.manifest.name).toBe("Google Maps Scraper");
    expect(gmaps?.manifest.kind).toBe("scraper");
    expect(gmaps?.enabled).toBe(true);
  });

  it("should filter enabled scrapers, enrichers and connectors by trigger", () => {
    const { getEnabledScrapers, getEnabledEnrichers, getEnabledConnectors } = require("../../../plugins/registry");
    const scrapers = getEnabledScrapers();
    expect(scrapers.length).toBe(7);
    expect(scrapers.some((s: any) => s.manifest.id === "google-maps")).toBe(true);
    expect(scrapers.some((s: any) => s.manifest.id === "scraper-yellowpages")).toBe(true);
    expect(scrapers.some((s: any) => s.manifest.id === "scraper-clutch")).toBe(true);

    const enrichers = getEnabledEnrichers();
    expect(enrichers.length).toBe(5);

    const connectors = getEnabledConnectors("outreach.replied");
    expect(connectors.length).toBeGreaterThanOrEqual(1);
    expect(connectors.some((c: any) => c.manifest.id === "connector-discord")).toBe(true);
  });

  it("should format a valid LeadSnapshot from raw database rows", () => {
    const { makeLeadSnapshot } = require("../../../plugins/runner");
    const rawRow = {
      id: 42,
      org_id: 1,
      business_name: "Apex Global",
      category: "Software",
      city: "San Francisco",
      country: "USA",
      email: "hello@apexglobal.com",
      status: "qualified"
    };

    const snapshot = makeLeadSnapshot(rawRow);
    expect(snapshot.id).toBe(42);
    expect(snapshot.business_name).toBe("Apex Global");
    expect(snapshot.email).toBe("hello@apexglobal.com");
    expect(snapshot.website_url).toBeNull();
    expect(snapshot.scraped_at).toBeDefined();
  });


});
