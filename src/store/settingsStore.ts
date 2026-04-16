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
};

interface SettingsStore {
  settings: AppSettings;
  fetchSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaultSettings,

  fetchSettings: async () => {
    try {
      const remote = await callSidecar<Record<string, string>>({
        method: "get_settings",
        params: {},
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
          },
        });
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  },

  updateSettings: async (newSettings) => {
    try {
      await callSidecar({
        method: "update_settings",
        params: { settings: newSettings },
      });
      set((state) => ({ settings: { ...state.settings, ...newSettings } }));
    } catch (err) {
      console.error("Failed to update settings:", err);
    }
  },
}));
