import { describe, it, expect } from "bun:test";
import { injectTrackingPixel, wrapClickLinks } from "@sdk/core/outreach/tracking-service";

describe("Outreach Email Tracking Injection", () => {
  it("should append a tracking pixel before closing body tag", () => {
    const rawHtml = "<html><body><p>Hello world</p></body></html>";
    const tracked = injectTrackingPixel(rawHtml, "msg-test-123", "https://api.apexlead.io");

    expect(tracked).toContain('<img src="https://api.apexlead.io/api/track/open/');
    expect(tracked).toContain("msg-test-123");
  });

  it("should wrap anchor hrefs with tracking redirector", () => {
    const rawHtml = '<a href="https://google.com">Visit Us</a>';
    const wrapped = wrapClickLinks(rawHtml, "msg-test-123", "https://api.apexlead.io");

    expect(wrapped).toContain("https://api.apexlead.io/api/track/click");
    expect(wrapped).toContain(encodeURIComponent("https://google.com"));
  });
});
