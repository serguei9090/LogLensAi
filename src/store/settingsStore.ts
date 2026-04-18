import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { create } from "zustand";

export interface AppSettings {
  ai_provider: string;
  ai_model: string;
  ai_api_key: string;
  ai_system_prompt: string;
  ai_gemini_url: string;
  ai_ollama_host: string;
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
}

export const defaultSettings: AppSettings = {
  ai_provider: "ollama",
  ai_model: "gemma4:e2b",
  ai_api_key: "",
  ai_system_prompt:
    "You are LogLens Assistant, a senior DevOps engineer and SRE specializing in root cause analysis.",
  ai_gemini_url: "http://localhost:22436",
  ai_ollama_host: "http://localhost:11434",
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
      pattern: "((?<=[^A-Za-z0-9])|^)(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})(?=[^A-Za-z0-9]|$)",
      label: "IP",
      enabled: true,
    },
    {
      pattern: "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
      label: "UUID",
      enabled: true,
    },
  ],
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
            mcp_server_enabled: remote.mcp_server_enabled === "true",
            ai_tool_search: remote.ai_tool_search !== "false", // default true
            ai_tool_memory: remote.ai_tool_memory !== "false", // default true
            drain_template_scope:
              (remote.drain_template_scope as "global" | "workspace") || "global",
            drain_masks: remote.drain_masks
              ? JSON.parse(remote.drain_masks)
              : defaultSettings.drain_masks,
          },
        });
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  },

  updateSettings: async (newSettings, workspaceId?: string) => {
    try {
      const payload: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(newSettings)) {
        if (k === "drain_masks") {
          payload[k] = JSON.stringify(v);
        } else {
          payload[k] = v as string | number | boolean;
        }
      }

      await callSidecar({
        method: "update_settings",
        params: { settings: payload, workspace_id: workspaceId },
      });
      // Optionally re-fetch to ensure sync, or just update local state
      set((state) => ({ settings: { ...state.settings, ...newSettings } }));
    } catch (err) {
      console.error("Failed to update settings:", err);
    }
  },
}));
