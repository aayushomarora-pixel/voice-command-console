import { describe, expect, it } from "vitest";
import { parseIntentContent } from "./intent";

describe("voice intent validation", () => {
  it("accepts a complete normalized URL intent", () => {
    const intent = parseIntentContent(JSON.stringify({ action: "open_url", confidence: 0.98, url: "https://example.com", query: null, note: null, reminderText: null, reminderMinutes: null, response: "Opening the site." }));
    expect(intent.action).toBe("open_url");
    expect(intent.url).toBe("https://example.com");
  });

  it("rejects unsupported actions", () => {
    expect(() => parseIntentContent({ action: "send_email", confidence: 1, response: "No" })).toThrow();
  });

  it("rejects confidence values outside the contract", () => {
    expect(() => parseIntentContent({ action: "tell_time", confidence: 2, response: "It is now." })).toThrow();
  });
});
