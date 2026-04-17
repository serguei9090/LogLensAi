import { describe, expect, it } from "vitest";
import { parseThinking } from "../../components/organisms/AIInvestigationSidebar.tsx";

describe("parseThinking Logic", () => {
  it("should handle standard <think> tags", () => {
    const input = "<think>I am reasoning</think>Final answer";
    const result = parseThinking(input);
    expect(result.thinking).toBe("I am reasoning");
    expect(result.response).toBe("Final answer");
    expect(result.isStreamingThink).toBe(false);
  });

  it("should handle Gemma 4 <|channel> tags", () => {
    const input = "<|channel>thought\nStep 1: Check logs\n<|channel>text\nLogs are clean.";
    const result = parseThinking(input);
    expect(result.thinking).toBe("Step 1: Check logs");
    expect(result.response).toBe("Logs are clean.");
    expect(result.isStreamingThink).toBe(false);
  });

  it("should handle streaming (unclosed) thought tags with channel markers stripped", () => {
    const input = "<|channel>thought\nStill thinking...";
    const result = parseThinking(input);
    // Channel tag stripping removes the raw marker; only clean content remains
    expect(result.thinking).toBe("\nStill thinking...");
    expect(result.response).toBe("");
    expect(result.isStreamingThink).toBe(true);
  });

  it("should handle cases where start tag is omitted but end tag is present", () => {
    const input = "Implicit thinking\n<|channel>text\nFinal result";
    const result = parseThinking(input);
    expect(result.thinking).toBe("Implicit thinking");
    expect(result.response).toBe("Final result");
    expect(result.isStreamingThink).toBe(false);
  });

  it("should correctly separate thinking and response when both tags are provided by backend", () => {
    const input = "<think>Direct thought</think>Direct response";
    const result = parseThinking(input);
    expect(result.thinking).toBe("Direct thought");
    expect(result.response).toBe("Direct response");
    expect(result.isStreamingThink).toBe(false);
  });

  it("should handle cases where the model forgets thinking tags but provides a reminder-induced transition", () => {
    const input = "Forgotten thought process\n<|channel>text\nFinal answer after nudge";
    const result = parseThinking(input);
    expect(result.thinking?.trim()).toBe("Forgotten thought process");
    expect(result.response.trim()).toBe("Final answer after nudge");
    expect(result.isStreamingThink).toBe(false);
  });

  it("should return raw content if no tags are found", () => {
    const input = "Just a normal chat message";
    const result = parseThinking(input);
    expect(result.thinking).toBe(null);
    expect(result.response).toBe("Just a normal chat message");
    expect(result.isStreamingThink).toBe(false);
  });

  it("should scrub all technical tags from the final response", () => {
    const input = "<|channel>thought Reasoning <|channel>text Response <think> Rogue Tag";
    const result = parseThinking(input);
    expect(result.response).toBe("Response  Rogue Tag"); // Should clean out tags
  });

  it("should handle noisy multi-tag fragmented stream (sidecar.log scenario)", () => {
    // Simulates corrupted DB content with repeated micro-tags.
    // The backend fix prevents this from happening going forward,
    // but old DB entries need graceful degradation.
    const input =
      "<|channel>thought\nThinking\n<channel|>" +
      "<|channel>thought\n Process\n<channel|>" +
      "<|channel>thought\n Analyze logs\n<channel|>" +
      "<|channel>text\nHello! How can I help you today?";
    const result = parseThinking(input);
    // Should extract thinking content from first start→end pair
    expect(result.thinking).toBe("Thinking");
    expect(result.isStreamingThink).toBe(false);
    // Remaining content falls into response with all channel markers stripped
    expect(result.response).not.toContain("<|channel>");
    expect(result.response).not.toContain("<channel|>");
    expect(result.response).toContain("Hello! How can I help you today?");
  });

  it("should strip leaked channel markers from plain content (no think tags)", () => {
    const input = "Some response <|channel>thought leaked <channel|> text here";
    const result = parseThinking(input);
    // The first <|channel>thought acts as a start tag
    expect(result.thinking).not.toBeNull();
    expect(result.thinking).not.toContain("<|channel>");
    expect(result.response).not.toContain("<|channel>");
    expect(result.response).not.toContain("<channel|>");
  });

  it("should handle <|think|> injection markers being stripped from response", () => {
    // Old corrupted history might contain the injected <|think|> marker
    const input = "<|think|>Some old corrupted content";
    const result = parseThinking(input);
    expect(result.response).toBe("Some old corrupted content");
    expect(result.response).not.toContain("<|think|>");
  });
});
