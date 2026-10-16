import { type AppSettings, type KeyboardShortcut, defaultSettings } from "@/store/settingsStore";

/**
 * Safely parse a raw settings string value that may be JSON or a
 * Python repr-style string (single quotes, True/False/None).
 */
export function safeParse(raw: string | null): unknown {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    // Fallback: handle Python repr strings (single quotes, True/False/None)
    try {
      const jsonified = raw
        .replaceAll("'", '"')
        .replaceAll("True", "true")
        .replaceAll("False", "false")
        .replaceAll("None", "null");
      return JSON.parse(jsonified);
    } catch (err) {
      console.debug("safeParse: Failed to parse Python repr fallback:", err);
      return null;
    }
  }
}

/**
 * Maps a flat record of raw sidecar setting strings into a typed AppSettings object.
 */
export function parseRemote(
  remoteSettings: Record<string, string>,
  prev: AppSettings,
): AppSettings {
  const next = {
    ...prev,
    ...remoteSettings,
    drain_similarity_threshold: Number.parseFloat(
      remoteSettings.drain_similarity_threshold || "0.4",
    ),
    drain_max_children: Number.parseInt(remoteSettings.drain_max_children || "100", 10),
    drain_max_clusters: Number.parseInt(remoteSettings.drain_max_clusters || "1000", 10),
    mcp_server_enabled: remoteSettings.mcp_server_enabled?.toLowerCase() === "true",
    ai_tool_search: remoteSettings.ai_tool_search?.toLowerCase() !== "false",
    ai_tool_memory: remoteSettings.ai_tool_memory?.toLowerCase() !== "false",
    ingestion_syslog_enabled: remoteSettings.ingestion_syslog_enabled?.toLowerCase() !== "false",
    ingestion_syslog_port: Number.parseInt(remoteSettings.ingestion_syslog_port || "514", 10),
    ingestion_http_enabled: remoteSettings.ingestion_http_enabled?.toLowerCase() !== "false",
    ingestion_http_port: Number.parseInt(remoteSettings.ingestion_http_port || "5002", 10),
    drain_masks: (() => {
      const parsed = safeParse(remoteSettings.drain_masks);
      return Array.isArray(parsed) ? parsed : defaultSettings.drain_masks;
    })(),
    facet_extractions: (() => {
      const parsed = safeParse(remoteSettings.facet_extractions);
      return Array.isArray(parsed) ? parsed : [];
    })(),
    ui_command_palette_shortcut: (() => {
      const raw = remoteSettings.ui_command_palette_shortcut;
      if (!raw) {
        return defaultSettings.ui_command_palette_shortcut;
      }

      const parsed = safeParse(raw);
      if (parsed && typeof parsed === "object" && "key" in parsed) {
        return parsed as KeyboardShortcut;
      }
      // Legacy support: if it's just a single character string
      if (typeof raw === "string" && raw.length === 1) {
        return { key: raw, ctrl: true };
      }
      return defaultSettings.ui_command_palette_shortcut;
    })(),
  };

  if (Array.isArray(next.drain_masks)) {
    next.drain_masks = next.drain_masks.filter((m) => m.label.trim() || m.pattern.trim());
    if (next.drain_masks.length === 0) {
      next.drain_masks = defaultSettings.drain_masks;
    }
  }
  if (Array.isArray(next.facet_extractions)) {
    next.facet_extractions = next.facet_extractions.filter((f) => f.name.trim() || f.regex.trim());
  }
  return next;
}
