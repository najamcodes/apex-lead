import { describe, it, expect } from "bun:test";
import thomasNetPlugin from "@sdk/plugins/built-in/scraper-thomasnet/index";
import crunchbasePlugin from "@sdk/plugins/built-in/scraper-crunchbase/index";
import g2Plugin from "@sdk/plugins/built-in/scraper-g2/index";

describe("Industrial, Venture, and SaaS Scrapers Suite", () => {
  it("ThomasNet plugin should yield industrial manufacturers with revenue and ISO certs", async () => {
    let progressCount = 0;
    const items: any[] = [];

    const generator = thomasNetPlugin.scrape({
      query: "Precision CNC Machining",
      city: "Cleveland, OH",
      country: "United States",
      max_results: 5,
      use_proxy: false,
      pluginConfig: { simulate: true },
      onProgress: (found) => {
        progressCount = found;
      },
    });

    for await (const item of generator) {
      items.push(item);
    }

    expect(items.length).toBe(5);
    expect(progressCount).toBe(5);

    const first = items[0];
    expect(first.pipeline).toBe("lead");
    expect(first.data.source).toBe("thomasnet");
    expect(first.data.business_name).toBeDefined();
    expect(first.data.estimated_annual_revenue).toBeGreaterThanOrEqual(1000000);
    expect(first.data.certifications).toBeArray();
    expect(first.data.certifications.length).toBeGreaterThan(0);
    expect(first.data.capabilities).toBeArray();
    expect(first.data.rfq_enabled).toBe(true);
  });

  it("Crunchbase plugin should yield funded startups with rounds and lead investors", async () => {
    const items: any[] = [];
    const generator = crunchbasePlugin.scrape({
      query: "Enterprise AI & Cloud Infrastructure",
      city: "San Francisco, CA",
      country: "United States",
      max_results: 4,
      use_proxy: false,
      pluginConfig: { simulate: true },
    });

    for await (const item of generator) {
      items.push(item);
    }

    expect(items.length).toBe(4);
    const first = items[0];
    expect(first.pipeline).toBe("lead");
    expect(first.data.source).toBe("crunchbase");
    expect(first.data.total_funding_usd).toBeGreaterThanOrEqual(3000000);
    expect(first.data.last_funding_type).toBeDefined();
    expect(first.data.lead_investors).toBeArray();
    expect(first.data.lead_investors.length).toBeGreaterThan(0);
    expect(first.data.growth_rate_pct).toBeGreaterThan(0);
    expect(first.data.crunchbase_url).toContain("crunchbase.com");
  });

  it("G2 plugin should yield B2B software vendors with Grid quadrants and pricing", async () => {
    const items: any[] = [];
    const generator = g2Plugin.scrape({
      query: "CRM & Marketing Automation",
      city: "",
      country: "United States",
      max_results: 4,
      use_proxy: false,
      pluginConfig: { simulate: true },
    });

    for await (const item of generator) {
      items.push(item);
    }

    expect(items.length).toBe(4);
    const first = items[0];
    expect(first.pipeline).toBe("lead");
    expect(first.data.source).toBe("g2");
    expect(first.data.product_name).toBeDefined();
    expect(first.data.g2_rating).toBeGreaterThan(4.0);
    expect(first.data.g2_reviews_count).toBeGreaterThan(0);
    expect(["Leader", "High Performer", "Contender", "Niche"]).toContain(first.data.g2_grid_quadrant);
    expect(first.data.estimated_enterprise_deal_usd).toBeGreaterThanOrEqual(10000);
    expect(first.data.key_competitors).toBeArray();
    expect(first.data.g2_url).toContain("g2.com");
  });
});
