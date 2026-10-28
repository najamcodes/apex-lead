import { describe, it, expect } from "bun:test";
import yellowPagesPlugin from "@sdk/plugins/built-in/scraper-yellowpages/index";
import clutchPlugin from "@sdk/plugins/built-in/scraper-clutch/index";
import contractorEstimatorPlugin from "@sdk/plugins/built-in/scraper-contractor-estimator/index";
import { resolveTradeBenchmark } from "@sdk/plugins/built-in/scraper-contractor-estimator/contractor-estimator";

describe("New Scraper Plugins Execution & Yielding", () => {
  it("YellowPages plugin should yield well-formed directory leads", async () => {
    let progressCount = 0;
    const items: any[] = [];

    const generator = yellowPagesPlugin.scrape({
      query: "Plumber",
      city: "Austin, TX",
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
    expect(first.data.source).toBe("yellowpages");
    expect(first.data.business_name).toBeDefined();
    expect(first.data.phone).toContain("555");
    expect(first.data.years_in_business).toBeGreaterThan(0);
    expect(first.data.bbb_rating).toBeDefined();
  });

  it("Clutch plugin should yield B2B agencies with project & hourly metrics", async () => {
    const items: any[] = [];
    const generator = clutchPlugin.scrape({
      query: "Custom Software Development",
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
    expect(first.data.source).toBe("clutch");
    expect(first.data.min_project_size).toBeGreaterThanOrEqual(10000);
    expect(first.data.avg_hourly_rate).toBeGreaterThan(0);
    expect(first.data.verification_status).toBe("Verified");
    expect(first.data.clutch_url).toContain("clutch.co");
  });

  it("Contractor Estimator plugin should resolve trade benchmarks and yield cost estimates", async () => {
    const roofingBm = resolveTradeBenchmark("Commercial Roofing Contractors");
    expect(roofingBm.trade).toBe("Roofing");
    expect(roofingBm.minCost).toBe(5000);
    expect(roofingBm.avgCost).toBe(12500);

    const solarBm = resolveTradeBenchmark("Solar Energy Solutions");
    expect(solarBm.trade).toBe("Solar Energy");
    expect(solarBm.minCost).toBe(15000);

    const items: any[] = [];
    const generator = contractorEstimatorPlugin.scrape({
      query: "Roofing",
      city: "Dallas, TX",
      country: "United States",
      max_results: 6,
      use_proxy: false,
      pluginConfig: { simulate: true },
    });

    for await (const item of generator) {
      items.push(item);
    }

    expect(items.length).toBe(6);
    const first = items[0];
    expect(first.pipeline).toBe("lead");
    expect(first.data.source).toBe("contractor_estimator");
    expect(first.data.trade).toBe("Roofing");
    expect(first.data.estimated_min_job_cost).toBeGreaterThan(0);
    expect(first.data.estimated_avg_job_cost).toBeGreaterThan(first.data.estimated_min_job_cost);
    expect(first.data.licensed).toBe(true);
    expect(first.data.insured).toBe(true);
    expect(["High Ticket", "Mid-Market", "Standard"]).toContain(first.data.lead_budget_tier);
  });
});
