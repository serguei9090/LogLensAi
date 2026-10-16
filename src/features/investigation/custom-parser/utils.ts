import type { ParserMapping } from "./types";

export function generateRegexFromMapping(mapping: {
  timestamp?: ParserMapping;
  level?: ParserMapping;
}): string {
  if (!mapping.timestamp && !mapping.level) {
    return "";
  }

  let pattern = "^";
  const sorted = Object.entries(mapping)
    .filter((entry): entry is [string, ParserMapping] => entry[1] !== undefined)
    .sort((a, b) => a[1].start - b[1].start);

  let lastIdx = 0;
  for (const [key, range] of sorted) {
    if (range.start > lastIdx) {
      pattern += `.{${range.start - lastIdx}}`;
    }
    pattern += `(?P<${key}>.{${range.end - range.start}})`;
    lastIdx = range.end;
  }
  pattern += ".*";
  return pattern;
}

export function computePreviewResults(
  regexPattern: string,
  samples: string[],
): { timestamp?: string; level?: string }[] {
  if (!regexPattern) {
    return [];
  }

  try {
    let jsRegexStr = regexPattern;
    const groupNames: string[] = [];
    const namedGroupRegex = /\(\?P<(\w+)>(.*?)\)/g;

    let m: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex iteration
    while ((m = namedGroupRegex.exec(regexPattern)) !== null) {
      groupNames.push(m[1]);
    }

    jsRegexStr = regexPattern.replaceAll(/\(\?P<\w+>(.*?)\)/g, "($1)");
    const jsRegex = new RegExp(jsRegexStr);

    return samples.map((line) => {
      const match = jsRegex.exec(line);
      if (!match) {
        return { timestamp: "No match", level: "---" };
      }

      const result: { timestamp?: string; level?: string } = {};
      groupNames.forEach((name, i) => {
        if (name === "timestamp") {
          result.timestamp = match[i + 1];
        }
        if (name === "level") {
          result.level = match[i + 1];
        }
      });

      return {
        timestamp: result.timestamp || match[0].substring(0, 20),
        level: result.level || "INFO",
      };
    });
  } catch (_error: unknown) {
    console.error("Regex preview generation failed", _error);
    return [];
  }
}

export interface HighlightSegment {
  text: string;
  type?: "timestamp" | "level";
}

export function splitLineIntoSegments(
  line: string,
  mapping: { timestamp?: ParserMapping; level?: ParserMapping },
): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let currentPos = 0;

  const hls = Object.entries(mapping)
    .filter((entry): entry is [string, ParserMapping] => entry[1] !== undefined)
    .sort((a, b) => a[1].start - b[1].start);

  for (const [type, range] of hls) {
    if (range.start > currentPos) {
      segments.push({ text: line.substring(currentPos, range.start) });
    }
    segments.push({
      text: line.substring(range.start, range.end),
      type: type as "timestamp" | "level",
    });
    currentPos = range.end;
  }

  if (currentPos < line.length) {
    segments.push({ text: line.substring(currentPos) });
  }

  return segments;
}
