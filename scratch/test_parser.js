function parseThinking(content) {
  if (!content) return { thinking: null, response: "", isStreamingThink: false };

  const startTags = ["<think>", "<|channel>thought"];
  const endTags = ["</think>", "<|channel>text", "<channel|>"];

  // Find the FIRST start tag
  let firstStartIdx = -1;
  let startTagLength = 0;
  for (const tag of startTags) {
    const idx = content.indexOf(tag);
    if (idx !== -1 && (firstStartIdx === -1 || idx < firstStartIdx)) {
      firstStartIdx = idx;
      startTagLength = tag.length;
    }
  }

  // Find the FIRST end tag that appears AFTER the start tag
  let firstEndIdx = -1;
  let endTagLength = 0;
  for (const tag of endTags) {
    const idx = content.indexOf(tag, firstStartIdx !== -1 ? firstStartIdx + startTagLength : 0);
    if (idx !== -1 && (firstEndIdx === -1 || idx < firstEndIdx)) {
      firstEndIdx = idx;
      endTagLength = tag.length;
    }
  }

  // Logic Phase
  if (firstEndIdx !== -1) {
    // We have a closed or switched block
    let thinking = "";
    if (firstStartIdx !== -1) {
      thinking = content.substring(firstStartIdx + startTagLength, firstEndIdx);
    } else {
      thinking = content.substring(0, firstEndIdx);
    }

    // Everything AFTER the end tag is the response
    let response = content.substring(firstEndIdx + endTagLength);

    // Strip other potential tags from response
    for (const tag of [...startTags, ...endTags]) {
      response = response.replaceAll(tag, "");
    }

    return {
      thinking: thinking.trim() || null,
      response: response.trim(),
      isStreamingThink: false,
    };
  }

  if (firstStartIdx !== -1) {
    // We are currently IN a thinking phase (streaming)
    return {
      thinking: content.substring(firstStartIdx + startTagLength),
      response: content.substring(0, firstStartIdx).trim(),
      isStreamingThink: true,
    };
  }

  return { thinking: null, response: content, isStreamingThink: false };
}

// TEST CASES
const sample = "1. Formulate Response: ...\n<|channel>text\nHello! How can I help you today?";
const result = parseThinking(sample);
console.log("TEST 1 (No Start Tag, has End Tag):", JSON.stringify(result, null, 2));

const sample2 = "<|channel>thought\nI am thinking...\n<|channel>text\nFinal answer.";
const result2 = parseThinking(sample2);
console.log("TEST 2 (Complete Gemma Protocol):", JSON.stringify(result2, null, 2));

const sample3 = "<|channel>thought\nStill thinking...";
const result3 = parseThinking(sample3);
console.log("TEST 3 (Streaming):", JSON.stringify(result3, null, 2));
