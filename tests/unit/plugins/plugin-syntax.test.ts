import { describe, it, expect } from "bun:test";

describe("Built-in Plugins Compilation & Syntax", () => {
  it("should successfully import Google Maps Scraper plugin", async () => {
    const mapsPluginMod = await import("@sdk/plugins/built-in/scraper-google-maps/index");
    const mapsPlugin = mapsPluginMod.default;
    expect(mapsPlugin).toBeDefined();
    expect(mapsPlugin.id).toBe("google-maps");
    expect(mapsPlugin.kind).toBe("scraper");
    expect(typeof mapsPlugin.scrape).toBe("function");
  });

  it("should successfully import Discord Connector plugin", async () => {
    const discordMod = await import("@sdk/plugins/built-in/connector-discord/discord");
    expect(discordMod).toBeDefined();
    expect(typeof discordMod.sendDiscordAlert).toBe("function");

    const discordPluginMod = await import("@sdk/plugins/built-in/connector-discord/index");
    const discordPlugin = discordPluginMod.default;
    expect(discordPlugin).toBeDefined();
    expect(discordPlugin.id).toBe("connector-discord");
    expect(discordPlugin.kind).toBe("connector");
    expect(typeof discordPlugin.push).toBe("function");
  });

  it("should successfully import Webhook Connector plugin", async () => {
    const webhookPluginMod = await import("@sdk/plugins/built-in/connector-webhook/index");
    const webhookPlugin = webhookPluginMod.default;
    expect(webhookPlugin).toBeDefined();
    expect(webhookPlugin.id).toBe("connector-webhook");
    expect(webhookPlugin.kind).toBe("connector");
    expect(typeof webhookPlugin.push).toBe("function");
  });

  it("should successfully import Hunter Enricher plugin", async () => {
    const hunterMod = await import("@sdk/plugins/built-in/enricher-hunter/index");
    const hunterPlugin = hunterMod.default;
    expect(hunterPlugin).toBeDefined();
    expect(hunterPlugin.id).toBe("enricher-hunter");
    expect(hunterPlugin.kind).toBe("enricher");
    expect(typeof hunterPlugin.enrich).toBe("function");
  });

  it("should successfully import PageSpeed Enricher plugin", async () => {
    const pageSpeedMod = await import("@sdk/plugins/built-in/enricher-pagespeed/index");
    const pageSpeedPlugin = pageSpeedMod.default;
    expect(pageSpeedPlugin).toBeDefined();
    expect(pageSpeedPlugin.id).toBe("enricher-pagespeed");
    expect(pageSpeedPlugin.kind).toBe("enricher");
    expect(typeof pageSpeedPlugin.enrich).toBe("function");
  });

  it("should successfully import SSL Enricher plugin", async () => {
    const sslMod = await import("@sdk/plugins/built-in/enricher-ssl/index");
    const sslPlugin = sslMod.default;
    expect(sslPlugin).toBeDefined();
    expect(sslPlugin.id).toBe("enricher-ssl");
    expect(sslPlugin.kind).toBe("enricher");
    expect(typeof sslPlugin.enrich).toBe("function");
  });

  it("should successfully import AI Decision Maker Enricher plugin", async () => {
    const aiMod = await import("@sdk/plugins/built-in/enricher-ai-decision-maker/index");
    const aiPlugin = aiMod.default;
    expect(aiPlugin).toBeDefined();
    expect(aiPlugin.id).toBe("enricher-ai-decision-maker");
    expect(aiPlugin.kind).toBe("enricher");
    expect(typeof aiPlugin.enrich).toBe("function");
  });

  it("should successfully import Slack Connector plugin", async () => {
    const slackMod = await import("@sdk/plugins/built-in/connector-slack/slack");
    expect(slackMod).toBeDefined();
    expect(typeof slackMod.sendSlackAlert).toBe("function");

    const slackPluginMod = await import("@sdk/plugins/built-in/connector-slack/index");
    const slackPlugin = slackPluginMod.default;
    expect(slackPlugin).toBeDefined();
    expect(slackPlugin.id).toBe("connector-slack");
    expect(slackPlugin.kind).toBe("connector");
    expect(typeof slackPlugin.push).toBe("function");
  });

  it("should successfully import DNS Deliverability Enricher plugin", async () => {
    const dnsMod = await import("@sdk/plugins/built-in/enricher-dns-deliverability/dns-checker");
    expect(dnsMod).toBeDefined();
    expect(typeof dnsMod.checkDomainDeliverability).toBe("function");

    const dnsPluginMod = await import("@sdk/plugins/built-in/enricher-dns-deliverability/index");
    const dnsPlugin = dnsPluginMod.default;
    expect(dnsPlugin).toBeDefined();
    expect(dnsPlugin.id).toBe("enricher-dns-deliverability");
    expect(dnsPlugin.kind).toBe("enricher");
    expect(typeof dnsPlugin.enrich).toBe("function");
  });

  it("should successfully import YellowPages Scraper plugin", async () => {
    const ypMod = await import("@sdk/plugins/built-in/scraper-yellowpages/yellowpages");
    expect(ypMod).toBeDefined();
    expect(typeof ypMod.scrapeYellowPages).toBe("function");

    const ypPluginMod = await import("@sdk/plugins/built-in/scraper-yellowpages/index");
    const ypPlugin = ypPluginMod.default;
    expect(ypPlugin).toBeDefined();
    expect(ypPlugin.id).toBe("scraper-yellowpages");
    expect(ypPlugin.kind).toBe("scraper");
    expect(typeof ypPlugin.scrape).toBe("function");
  });

  it("should successfully import Clutch B2B Scraper plugin", async () => {
    const clutchMod = await import("@sdk/plugins/built-in/scraper-clutch/clutch");
    expect(clutchMod).toBeDefined();
    expect(typeof clutchMod.scrapeClutch).toBe("function");

    const clutchPluginMod = await import("@sdk/plugins/built-in/scraper-clutch/index");
    const clutchPlugin = clutchPluginMod.default;
    expect(clutchPlugin).toBeDefined();
    expect(clutchPlugin.id).toBe("scraper-clutch");
    expect(clutchPlugin.kind).toBe("scraper");
    expect(typeof clutchPlugin.scrape).toBe("function");
  });

  it("should successfully import Contractor Estimator Scraper plugin", async () => {
    const contractorMod = await import("@sdk/plugins/built-in/scraper-contractor-estimator/contractor-estimator");
    expect(contractorMod).toBeDefined();
    expect(typeof contractorMod.scrapeContractors).toBe("function");
    expect(typeof contractorMod.resolveTradeBenchmark).toBe("function");

    const contractorPluginMod = await import("@sdk/plugins/built-in/scraper-contractor-estimator/index");
    const contractorPlugin = contractorPluginMod.default;
    expect(contractorPlugin).toBeDefined();
    expect(contractorPlugin.id).toBe("scraper-contractor-estimator");
    expect(contractorPlugin.kind).toBe("scraper");
    expect(typeof contractorPlugin.scrape).toBe("function");
  });

  it("should successfully import ThomasNet Industrial Scraper plugin", async () => {
    const thomasMod = await import("@sdk/plugins/built-in/scraper-thomasnet/thomasnet");
    expect(thomasMod).toBeDefined();
    expect(typeof thomasMod.scrapeThomasNet).toBe("function");

    const thomasPluginMod = await import("@sdk/plugins/built-in/scraper-thomasnet/index");
    const thomasPlugin = thomasPluginMod.default;
    expect(thomasPlugin).toBeDefined();
    expect(thomasPlugin.id).toBe("scraper-thomasnet");
    expect(thomasPlugin.kind).toBe("scraper");
    expect(typeof thomasPlugin.scrape).toBe("function");
  });

  it("should successfully import Crunchbase Startup Scraper plugin", async () => {
    const crunchMod = await import("@sdk/plugins/built-in/scraper-crunchbase/crunchbase");
    expect(crunchMod).toBeDefined();
    expect(typeof crunchMod.scrapeCrunchbase).toBe("function");

    const crunchPluginMod = await import("@sdk/plugins/built-in/scraper-crunchbase/index");
    const crunchPlugin = crunchPluginMod.default;
    expect(crunchPlugin).toBeDefined();
    expect(crunchPlugin.id).toBe("scraper-crunchbase");
    expect(crunchPlugin.kind).toBe("scraper");
    expect(typeof crunchPlugin.scrape).toBe("function");
  });

  it("should successfully import G2 Software Scraper plugin", async () => {
    const g2Mod = await import("@sdk/plugins/built-in/scraper-g2/g2");
    expect(g2Mod).toBeDefined();
    expect(typeof g2Mod.scrapeG2).toBe("function");

    const g2PluginMod = await import("@sdk/plugins/built-in/scraper-g2/index");
    const g2Plugin = g2PluginMod.default;
    expect(g2Plugin).toBeDefined();
    expect(g2Plugin.id).toBe("scraper-g2");
    expect(g2Plugin.kind).toBe("scraper");
    expect(typeof g2Plugin.scrape).toBe("function");
  });
});

