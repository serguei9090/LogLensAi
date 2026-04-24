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
  ai_gemini_url: string;
  ai_ollama_host: string;
  ai_openai_host: string;
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
}

export const defaultSettings: AppSettings = {
  ai_provider: "ollama",
  ai_model: "gemma4:e2b",
  ai_api_key: "",
  ai_system_prompt:
    "You are LogLens Assistant, a senior DevOps engineer and SRE specializing in root cause analysis.",
  ai_gemini_url: "http://localhost:22436",
  ai_ollama_host: "http://localhost:11434",
  ai_openai_host: "https://api.openai.com/v1",
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
      pattern: String.raw`((?<=[^A-Za-z0-9])|^)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?=[^A-Za-z0-9]|$)`,
      label: "IP",
      enabled: true,
    },
    {
      pattern: "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
      label: "UUID",
      enabled: true,
    },
  ],
  ingestion_syslog_enabled: true,
  ingestion_syslog_port: 514,
  ingestion_http_enabled: true,
  ingestion_http_port: 5002,
  facet_extractions: [],
  ui_command_palette_shortcut: { key: "k", ctrl: true },
};

interface SettingsStore {
  settings: AppSettings;
  fetchSettings: (workspaceId?: string) => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>, workspaceId?: string) => Promise<void>;
}

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

    // 2. Debounced persistence to sidecar
    // We use a module-level variable or a simple timeout to debounce the RPC call
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      try {
        const payload: Record<string, string | number | boolean> = {};
        // The sidecar expects a dict of settings to update.
        // To be safe and consistent with the existing API, we'll send the updated fields.
        for (const [k, v] of Object.entries(newSettings)) {
          if (k === "drain_masks" || k === "facet_extractions") {
            payload[k] = JSON.stringify(v);
          } else {
            payload[k] = v as string | number | boolean;
          }
        }

        await callSidecar({
          method: "update_settings",
          params: { settings: payload, workspace_id: workspaceId },
        });
      } catch (err) {
        console.error("Failed to persist settings to sidecar:", err);
      } finally {
        saveTimeout = null;
      }
    }, 500);
  },
}));

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
