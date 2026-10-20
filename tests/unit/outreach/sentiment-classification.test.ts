import { describe, it, expect } from "bun:test";
import { classifyReplySentiment } from "@sdk/core/outreach/sentiment-classifier";

describe("Email Reply Sentiment & Intent Classification", () => {
  it("should classify unsubscribes and stop requests as negative", () => {
    const text = "Please take me off your mailing list, not interested.";
    const result = classifyReplySentiment(text);
    expect(result.classification).toBe("negative");
    expect(result.shouldHaltSequence).toBe(true);
  });

  it("should classify meeting interest as positive", () => {
    const text = "Thanks for reaching out! Do you have time for a quick 10-minute demo on Friday?";
    const result = classifyReplySentiment(text);
    expect(result.classification).toBe("positive");
    expect(result.shouldHaltSequence).toBe(true);
  });

  it("should detect out of office automated autoresponders", () => {
    const text = "I am currently out of the office with limited email access. I will respond upon my return on Monday.";
    const result = classifyReplySentiment(text);
    expect(result.classification).toBe("ooo");
  });
});
