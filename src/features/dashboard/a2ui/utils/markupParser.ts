import type { A2UIComponent } from "../types";

function parseSingleTag(statement: string): A2UIComponent | null {
  const trimmed = statement.trim();
  if (!trimmed) {
    return null;
  }

  // Handle Button Tag: button label="Text" action={...}
  if (trimmed.startsWith("button")) {
    const labelMatch = /label=["']([^"']+)["']/.exec(trimmed);
    const actionMatch = /action=\{([^}]+)\}/.exec(trimmed);

    if (labelMatch) {
      let action: { type: string; [key: string]: unknown } | undefined;
      if (actionMatch) {
        try {
          action = JSON.parse(`{${actionMatch[1]}}`);
        } catch (e) {
          console.warn("Failed to parse action JSON in A2UI markup:", e);
        }
      }

      return {
        type: "button",
        label: labelMatch[1],
        action,
      };
    }
  }

  // Handle Text Tag: text value="..."
  if (trimmed.startsWith("text")) {
    const textMatch = /value=["']([^"']+)["']/.exec(trimmed);
    if (textMatch) {
      return {
        type: "text",
        text: textMatch[1],
      };
    }
  }

  // Handle Metric Tag: metric label="..." query="..." source_id="..." color="..."
  if (trimmed.startsWith("metric")) {
    const labelMatch = /label=["']([^"']+)["']/.exec(trimmed);
    const queryMatch = /query=["']([^"']+)["']/.exec(trimmed);
    const sourceMatch = /source_ids?=["']([^"']+)["']/.exec(trimmed);
    const colorMatch = /color=["']([^"']+)["']/.exec(trimmed);
    if (labelMatch && queryMatch) {
      const sourceIds = sourceMatch
        ? sourceMatch[1]
            .split(",")
            .map((s) => s.replace(/['"]/g, "").trim())
            .filter(Boolean)
        : undefined;
      return {
        type: "metric",
        label: labelMatch[1],
        props: {
          query: queryMatch[1],
          source_ids: sourceIds,
          color: colorMatch ? colorMatch[1] : undefined,
        },
      };
    }
  }

  // Handle Chart Area Tag: chart_area title="..." query="..." source_id="..."
  if (trimmed.startsWith("chart_area")) {
    const titleMatch = /title=["']([^"']+)["']/.exec(trimmed);
    const queryMatch = /query=["']([^"']+)["']/.exec(trimmed);
    const sourceMatch = /source_ids?=["']([^"']+)["']/.exec(trimmed);
    if (titleMatch && queryMatch) {
      const sourceIds = sourceMatch
        ? sourceMatch[1]
            .split(",")
            .map((s) => s.replace(/['"]/g, "").trim())
            .filter(Boolean)
        : undefined;
      return {
        type: "chart_area",
        label: titleMatch[1],
        props: { query: queryMatch[1], source_ids: sourceIds },
      };
    }
  }

  // Handle Data Table Tag: data_table title="..." query="..." source_id="..."
  if (trimmed.startsWith("data_table")) {
    const titleMatch = /title=["']([^"']+)["']/.exec(trimmed);
    const queryMatch = /query=["']([^"']+)["']/.exec(trimmed);
    const sourceMatch = /source_ids?=["']([^"']+)["']/.exec(trimmed);
    if (titleMatch && queryMatch) {
      const sourceIds = sourceMatch
        ? sourceMatch[1]
            .split(",")
            .map((s) => s.replace(/['"]/g, "").trim())
            .filter(Boolean)
        : undefined;
      return {
        type: "data_table",
        label: titleMatch[1],
        props: { query: queryMatch[1], source_ids: sourceIds },
      };
    }
  }

  return null;
}

/**
 * Parses A2UI Markup format (e.g. [[A2UI]] metric label="..." query="..." [[/A2UI]])
 */
export function parseA2UIMarkup(raw: string): A2UIComponent | null {
  const clean = raw.replaceAll("[[A2UI]]", "").replaceAll("[[/A2UI]]", "").trim();

  if (!clean) {
    return null;
  }

  const tagRegex = /(?:metric|button|text|chart_area|data_table)\s+[^[\]\n\r]+/g;
  const matches = clean.match(tagRegex);

  if (matches && matches.length > 0) {
    const components: A2UIComponent[] = [];
    for (const chunk of matches) {
      const parsed = parseSingleTag(chunk);
      if (parsed) {
        components.push(parsed);
      }
    }

    if (components.length === 1) {
      return components[0];
    }
    if (components.length > 1) {
      return {
        type: "surface",
        children: components,
      };
    }
  }

  return parseSingleTag(clean);
}
