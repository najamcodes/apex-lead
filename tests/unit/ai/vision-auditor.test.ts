import { describe, it, expect } from "bun:test";
import { formatVisionPromptPayload } from "@sdk/core/ai/vision-auditor";

describe("Multi-Modal Vision Prompt Formatting", () => {
  it("should assemble standard OpenAI/Gemini image content parts", () => {
    const mockBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const payload = formatVisionPromptPayload("https://acme.org", mockBase64);

    expect(Array.isArray(payload.messages[0].content)).toBe(true);
    const content = payload.messages[0].content as any[];
    const imagePart = content.find((p: any) => p.type === "image_url");
    expect(imagePart).toBeDefined();
    expect(imagePart.image_url.url).toContain("data:image/png;base64,");
  });
});
