import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { create } from "zustand";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface AppSettings {
  ai_provider: string;
  ai_model: string;
  ai_api_key: string;
  ai_system_prompt: string;
  ai_ollama_host: string;
  ai_openai_host: string;
  ai_openrouter_host: string;
  ai_lmstudio_host: string;
  drain_similarity_threshold: number;
  drain_max_children: number;
  drain_max_clusters: number;
  ui_row_height: string;
  ui_font_size: string;
  mcp_server_enabled: boolean;
  ai_tool_search: boolean;
  ai_tool_memory: boolean;
  drain_template_scope: "global" | "workspace";
  drain_masks: Array<{ pattern: string; label: string; enabled: boolean }>;
  ingestion_syslog_enabled: boolean;
  ingestion_syslog_port: number;
  ingestion_http_enabled: boolean;
  ingestion_http_port: number;
  facet_extractions: Array<{ name: string; regex: string; group: number; enabled: boolean }>;
  ui_command_palette_shortcut: KeyboardShortcut;
  timestamp_auto_detect: boolean;
  timestamp_custom_regex: string;
  timestamp_custom_format: string;
}

export const defaultSettings: AppSettings = {
  ai_provider: "ollama",
  ai_model: "gemma4:e2b",
  ai_api_key: "",
  ai_system_prompt:
    "You are LogLens Assistant, a senior DevOps engineer and SRE specializing in root cause analysis.",
  ai_ollama_host: "http://localhost:11434",
  ai_openai_host: "https://api.openai.com/v1",
  ai_openrouter_host: "https://openrouter.ai/api/v1",
  ai_lmstudio_host: "http://localhost:1234/v1",
  drain_similarity_threshold: 0.5,
  drain_max_children: 100,
  drain_max_clusters: 1000,
  ui_row_height: "36px",
  ui_font_size: "13px",
  mcp_server_enabled: false,
  ai_tool_search: true,
  ai_tool_memory: true,
  drain_template_scope: "global",
  drain_masks: [
    {
      // \b word-boundary works in Python re; variable-width lookbehind alternatives do not.
      pattern: String.raw`\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`,
      label: "IP",
      enabled: true,
    },
    {
      pattern: "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
      label: "UUID",
      enabled: true,
    },
    {
      // HTTP status codes 100-599
      pattern: String.raw`\b([1-5][0-9]{2})\b`,
      label: "HTTP_STATUS",
      enabled: true,
    },
    {
      // HTTP methods
      pattern: String.raw`\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE)\b`,
      label: "HTTP_METHOD",
      enabled: true,
    },
    {
      // Memory pointers, object IDs, hexadecimal hashes
      pattern: String.raw`\b(0x[0-9a-fA-F]+|[0-9a-fA-F]{16,64})\b`,
      label: "HEX",
      enabled: true,
    },
    {
      // Durations (took 200ms, 1.5s, etc.)
      pattern: String.raw`\b\d+(?:\.\d+)?(?:ms|s|ns|µs|m)\b`,
      label: "DURATION",
      enabled: true,
    },
    {
      // Email addresses
      pattern: String.raw`\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b`,
      label: "EMAIL",
      enabled: true,
    },
    {
      // Hardware MAC addresses
      pattern: String.raw`\b(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}\b`,
      label: "MAC",
      enabled: true,
    },
    {
      // ISO / SQL date-time stamps
      pattern: String.raw`\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b`,
      label: "DATETIME",
      enabled: true,
    },
    {
      // File paths & URLs
      pattern: String.raw`\b(https?://[^\s]+|/[a-zA-Z0-9_\-\./]+)\b`,
      label: "PATH",
      enabled: false,
    },
    {
      // Generic numbers (integers)
      pattern: String.raw`\b\d+\b`,
      label: "NUM",
      enabled: false,
    },
  ],
  ingestion_syslog_enabled: true,
  ingestion_syslog_port: 514,
  ingestion_http_enabled: true,
  ingestion_http_port: 5002,
  facet_extractions: [
    {
      name: "status_code",
      regex: String.raw`\b([1-5][0-9]{2})\b`,
      group: 1,
      enabled: true,
    },
    {
      name: "duration",
      regex: String.raw`took\s+(\d+(?:\.\d+)?\s*(?:ms|s)?)`,
      group: 1,
      enabled: true,
    },
    {
      name: "user",
      regex: String.raw`user(?:name)?[:=]\s*([a-zA-Z0-9_\.\-]+)`,
      group: 1,
      enabled: true,
    },
  ],
  ui_command_palette_shortcut: { key: "k", ctrl: true },
  timestamp_auto_detect: true,
  timestamp_custom_regex: "",
  timestamp_custom_format: "",
};

interface SettingsStore {
  settings: AppSettings;
  fetchSettings: (workspaceId?: string) => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>, workspaceId?: string) => Promise<void>;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSettingsPayload: Record<string, unknown> = {};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaultSettings,

  fetchSettings: async (workspaceId?: string) => {
    try {
      const remote = await callSidecar<Record<string, string>>({
        method: "get_settings",
        params: { workspace_id: workspaceId },
      });

      const safeParse = (raw: string | null) => {
        if (!raw) {
          return null;
        }
        try {
          return JSON.parse(raw);
        } catch (e) {
          console.debug(
            "Standard JSON parse failed in settings store, attempting legacy fix...",
            e,
          );
          try {
            const jsonified = raw
              .replaceAll("'", '"')
              .replaceAll("True", "true")
              .replaceAll("False", "false")
              .replaceAll("None", "null");
            return JSON.parse(jsonified);
          } catch (innerError) {
            console.error("Deep JSON parsing failed in settings store", innerError);
            return null;
          }
        }
      };

      if (remote) {
        set({
          settings: {
            ...defaultSettings,
            ...remote,
            drain_similarity_threshold: Number.parseFloat(
              remote.drain_similarity_threshold || "0.5",
            ),
            drain_max_children: Number.parseInt(remote.drain_max_children || "100", 10),
            drain_max_clusters: Number.parseInt(remote.drain_max_clusters || "1000", 10),
            mcp_server_enabled: remote.mcp_server_enabled?.toLowerCase() === "true",
            ai_tool_search: remote.ai_tool_search?.toLowerCase() !== "false", // default true
            ai_tool_memory: remote.ai_tool_memory?.toLowerCase() !== "false", // default true
            drain_template_scope:
              (remote.drain_template_scope as "global" | "workspace") || "global",
            drain_masks: (() => {
              const parsed = safeParse(remote.drain_masks);
              return Array.isArray(parsed) ? parsed : defaultSettings.drain_masks;
            })(),
            ingestion_syslog_enabled: remote.ingestion_syslog_enabled?.toLowerCase() !== "false",
            ingestion_syslog_port: Number.parseInt(remote.ingestion_syslog_port || "514", 10),
            ingestion_http_enabled: remote.ingestion_http_enabled?.toLowerCase() !== "false",
            ingestion_http_port: Number.parseInt(remote.ingestion_http_port || "5002", 10),
            facet_extractions: (() => {
              const parsed = safeParse(remote.facet_extractions);
              return Array.isArray(parsed) ? parsed : [];
            })(),
            ui_command_palette_shortcut: (() => {
              const parsed = safeParse(remote.ui_command_palette_shortcut);
              return parsed && typeof parsed === "object" && "key" in parsed
                ? (parsed as KeyboardShortcut)
                : defaultSettings.ui_command_palette_shortcut;
            })(),
            timestamp_auto_detect: remote.timestamp_auto_detect?.toLowerCase() !== "false",
            timestamp_custom_regex: remote.timestamp_custom_regex || "",
            timestamp_custom_format: remote.timestamp_custom_format || "",
          },
        });
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  },

  updateSettings: async (newSettings, workspaceId?: string) => {
    // 1. Update local state immediately for UI responsiveness
    set((state) => ({ settings: { ...state.settings, ...newSettings } }));

    // 2. Accumulate all changed fields so fast sequential updates aren't dropped
    for (const [k, v] of Object.entries(newSettings)) {
      if (k === "drain_masks" || k === "facet_extractions") {
        pendingSettingsPayload[k] = JSON.stringify(v);
      } else {
        pendingSettingsPayload[k] = v;
      }
    }

    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      const payloadToSend = { ...pendingSettingsPayload };
      pendingSettingsPayload = {};
      saveTimeout = null;

      try {
        await callSidecar({
          method: "update_settings",
          params: { settings: payloadToSend, workspace_id: workspaceId },
        });
      } catch (err) {
        console.error("Failed to persist settings to sidecar:", err);
      }
    }, 300);
  },
}));
