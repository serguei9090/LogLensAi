/**
 * Extracts <think>...</think> blocks from model responses.
 * Returns the thinking content and the clean response separately,
 * and handles unclosed tags during active streaming.
 *
 * Also defensively strips raw Gemma4 channel markers
 * (`<|channel>thought`, `<|channel>text`, `<channel|>`) that may
 * leak from corrupted DB history or incomplete backend parsing.
 */

/** Raw channel markers emitted by Gemma4 models that should never appear in UI. */
export const CHANNEL_TAGS = [
  "<|channel>thought",
  "<|channel|>thought",
  "<|channel>text",
  "<|channel|>text",
  "<channel|>",
  "<|think|>",
  "<|thought|>",
  "<|text|>",
] as const;

/** Strip all known raw channel markers from a string. */
export function stripChannelTags(text: string): string {
  let result = text;
  for (const tag of CHANNEL_TAGS) {
    result = result.replaceAll(tag, "");
  }
  return result;
}

export const A2UI_REGEX = /\[\[A2UI\]\].*?(\[\[\/A2UI\]\]|$)/gs;

/** Strip A2UI v0.9 tags from display text. */
export function stripA2UITags(text: string): string {
  return text.replaceAll(A2UI_REGEX, "").trim();
}

export function findFirstTagIndex(
  content: string,
  tags: readonly string[],
  startSearchFrom = 0,
): { index: number; length: number } {
  let firstIdx = -1;
  let tagLen = 0;
  for (const tag of tags) {
    const idx = content.indexOf(tag, startSearchFrom);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
      tagLen = tag.length;
    }
  }
  return { index: firstIdx, length: tagLen };
}

export function parseThinking(content: string): {
  thinking: string | null;
  response: string;
  isStreamingThink: boolean;
} {
  if (!content) {
    return { thinking: null, response: "", isStreamingThink: false };
  }

  const startTags = [
    "<think>",
    "<|channel>thought",
    "<|channel|>thought",
    "<|thought|>",
    "[reasoning]",
  ];
  const endTags = [
    "</think>",
    "<|channel>text",
    "<|channel|>text",
    "<channel|>",
    "<|text|>",
    "[/reasoning]",
  ];

  // 1. Find the FIRST start tag
  const { index: firstStartIdx, length: startTagLength } = findFirstTagIndex(content, startTags);

  // 2. Find the FIRST end tag that appears AFTER the start tag
  const searchStart = firstStartIdx === -1 ? 0 : firstStartIdx + startTagLength;
  const { index: firstEndIdx, length: endTagLength } = findFirstTagIndex(
    content,
    endTags,
    searchStart,
  );

  // 3. Phase: Terminal (Found transition)
  if (firstEndIdx !== -1) {
    const prefix = firstStartIdx === -1 ? "" : content.substring(0, firstStartIdx);
    let thinking = "";
    if (firstStartIdx === -1) {
      thinking = content.substring(0, firstEndIdx);
    } else {
      thinking = content.substring(firstStartIdx + startTagLength, firstEndIdx);
    }

    let response = prefix + content.substring(firstEndIdx + endTagLength);

    // Clean all tags from both thinking and response to prevent technical leakage
    thinking = stripChannelTags(thinking);
    response = stripChannelTags(response);

    // Also strip any remaining structural tags
    for (const tag of [...startTags, ...endTags]) {
      response = response.replaceAll(tag, "");
      thinking = thinking.replaceAll(tag, "");
    }

    return {
      thinking: thinking.trim() || null,
      response: stripA2UITags(response.trim()),
      isStreamingThink: false,
    };
  }

  // 4. Phase: Active (Inside thinking)
  if (firstStartIdx !== -1) {
    let thinkingContent = content.substring(firstStartIdx + startTagLength);
    // Strip channel markers from active thinking content
    thinkingContent = stripChannelTags(thinkingContent);

    return {
      thinking: thinkingContent,
      response: content.substring(0, firstStartIdx).trim(),
      isStreamingThink: true,
    };
  }

  // 5. No thinking tags found — strip any leaked channel markers and A2UI tags from plain response
  return {
    thinking: null,
    response: stripA2UITags(stripChannelTags(content)),
    isStreamingThink: false,
  };
}
