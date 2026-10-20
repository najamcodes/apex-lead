import { describe, it, expect } from "bun:test";
import { extractEmailsFromHtml, cleanPhoneNumber } from "@sdk/core/scraper/extractor-utils";

describe("Scraper Data Normalization & Extraction Utilities", () => {
  it("should extract valid emails and discard false-positive media filenames", () => {
    const mockHtml = `
      <div>
        <p>Contact us at hello@acme.org or sales@acme.com</p>
        <img src="/assets/hero@2x.png" />
        <img src="/icons/mail@3x.jpg" />
      </div>
    `;
    const emails = extractEmailsFromHtml(mockHtml);
    expect(emails).toContain("hello@acme.org");
    expect(emails).toContain("sales@acme.com");
    expect(emails).not.toContain("hero@2x.png");
    expect(emails).not.toContain("mail@3x.jpg");
  });

  it("should normalize diverse phone number formats", () => {
    expect(cleanPhoneNumber("+1 (555) 234-5678")).toBe("+15552345678");
    expect(cleanPhoneNumber("555.234.5678")).toBe("5552345678");
  });
});
