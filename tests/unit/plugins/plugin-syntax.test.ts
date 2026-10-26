import { describe, it, expect } from "bun:test";

describe("Built-in Plugins Compilation & Syntax", () => {
  it("should successfully import Google Maps Scraper plugin", async () => {
    const mapsPluginMod = await import("../../../plugins/built-in/scraper-google-maps/index");
    const mapsPlugin = mapsPluginMod.default;
    expect(mapsPlugin).toBeDefined();
    expect(mapsPlugin.id).toBe("google-maps");
    expect(mapsPlugin.kind).toBe("scraper");
    expect(typeof mapsPlugin.scrape).toBe("function");
  });

  it("should successfully import Discord Connector plugin", async () => {
    const discordMod = await import("../../../plugins/built-in/connector-discord/discord");
    expect(discordMod).toBeDefined();
    expect(typeof discordMod.sendDiscordAlert).toBe("function");

    const discordPluginMod = await import("../../../plugins/built-in/connector-discord/index");
    const discordPlugin = discordPluginMod.default;
    expect(discordPlugin).toBeDefined();
    expect(discordPlugin.id).toBe("connector-discord");
    expect(discordPlugin.kind).toBe("connector");
    expect(typeof discordPlugin.push).toBe("function");
  });

  it("should successfully import Webhook Connector plugin", async () => {
    const webhookPluginMod = await import("../../../plugins/built-in/connector-webhook/index");
    const webhookPlugin = webhookPluginMod.default;
    expect(webhookPlugin).toBeDefined();
    expect(webhookPlugin.id).toBe("connector-webhook");
    expect(webhookPlugin.kind).toBe("connector");
    expect(typeof webhookPlugin.push).toBe("function");
  });

  it("should successfully import Hunter Enricher plugin", async () => {
    const hunterMod = await import("../../../plugins/built-in/enricher-hunter/index");
    const hunterPlugin = hunterMod.default;
    expect(hunterPlugin).toBeDefined();
    expect(hunterPlugin.id).toBe("enricher-hunter");
    expect(hunterPlugin.kind).toBe("enricher");
    expect(typeof hunterPlugin.enrich).toBe("function");
  });

  it("should successfully import PageSpeed Enricher plugin", async () => {
    const pageSpeedMod = await import("../../../plugins/built-in/enricher-pagespeed/index");
    const pageSpeedPlugin = pageSpeedMod.default;
    expect(pageSpeedPlugin).toBeDefined();
    expect(pageSpeedPlugin.id).toBe("enricher-pagespeed");
    expect(pageSpeedPlugin.kind).toBe("enricher");
    expect(typeof pageSpeedPlugin.enrich).toBe("function");
  });

  it("should successfully import SSL Enricher plugin", async () => {
    const sslMod = await import("../../../plugins/built-in/enricher-ssl/index");
    const sslPlugin = sslMod.default;
    expect(sslPlugin).toBeDefined();
    expect(sslPlugin.id).toBe("enricher-ssl");
    expect(sslPlugin.kind).toBe("enricher");
    expect(typeof sslPlugin.enrich).toBe("function");
  });

  it("should successfully import AI Decision Maker Enricher plugin", async () => {
    const aiMod = await import("../../../plugins/built-in/enricher-ai-decision-maker/index");
    const aiPlugin = aiMod.default;
    expect(aiPlugin).toBeDefined();
    expect(aiPlugin.id).toBe("enricher-ai-decision-maker");
    expect(aiPlugin.kind).toBe("enricher");
    expect(typeof aiPlugin.enrich).toBe("function");
  });

  it("should successfully import Slack Connector plugin", async () => {
    const slackMod = await import("../../../plugins/built-in/connector-slack/slack");
    expect(slackMod).toBeDefined();
    expect(typeof slackMod.sendSlackAlert).toBe("function");

    const slackPluginMod = await import("../../../plugins/built-in/connector-slack/index");
    const slackPlugin = slackPluginMod.default;
    expect(slackPlugin).toBeDefined();
    expect(slackPlugin.id).toBe("connector-slack");
    expect(slackPlugin.kind).toBe("connector");
    expect(typeof slackPlugin.push).toBe("function");
  });

  it("should successfully import DNS Deliverability Enricher plugin", async () => {
    const dnsMod = await import("../../../plugins/built-in/enricher-dns-deliverability/dns-checker");
    expect(dnsMod).toBeDefined();
    expect(typeof dnsMod.checkDomainDeliverability).toBe("function");

    const dnsPluginMod = await import("../../../plugins/built-in/enricher-dns-deliverability/index");
    const dnsPlugin = dnsPluginMod.default;
    expect(dnsPlugin).toBeDefined();
    expect(dnsPlugin.id).toBe("enricher-dns-deliverability");
    expect(dnsPlugin.kind).toBe("enricher");
    expect(typeof dnsPlugin.enrich).toBe("function");
  });
});
