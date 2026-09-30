// Assume Role: Frontend Engineer (@frontend)

import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import type {
  LayaCheckpoint,
  LayaDecisionResult,
  LayaQuestion,
  LayaSettings,
} from "@/types/laya";
import { create } from "zustand";

interface LayaStore {
  settings: LayaSettings;
  checkpoints: LayaCheckpoint[];
  isLoading: boolean;
  isTesting: boolean;
  testResult: LayaDecisionResult | null;
  error: string | null;

  modelStatus: import("@/types/laya").LayaModelStatus | null;
  fetchSettings: (workspaceId?: string) => Promise<void>;
  updateSettings: (params: { enabled?: boolean; device?: "cpu" | "gpu"; workspaceId?: string }) => Promise<void>;
  fetchCheckpoints: (workspaceId?: string) => Promise<void>;
  fetchModelStatus: (workspaceId?: string) => Promise<void>;
  downloadModel: (workspaceId?: string) => Promise<void>;
  rollbackCheckpoint: (checkpointId: string, workspaceId?: string) => Promise<void>;
  saveRules: (
    author: string,
    description: string,
    questions: Record<string, LayaQuestion>,
    workspaceId?: string,
  ) => Promise<void>;
  testRule: (
    stateText: string,
    questionName?: string,
    question?: LayaQuestion,
    workspaceId?: string,
  ) => Promise<LayaDecisionResult | null>;
  clearTestResult: () => void;
}

const defaultLayaSettings: LayaSettings = {
  enabled: false,
  device: "cpu",
  active_checkpoint: "chk_init",
  questions: {
    tool_intent: {
      type: "choice",
      instructions: "Classify the user intent into the appropriate log analysis tool or conversation.",
      options: [
        "search_logs",
        "get_clusters",
        "search_memory",
        "get_facets",
        "conversational_qa",
      ],
    },
    severity: {
      type: "score",
      instructions: "Rate the operational impact and severity of the log template.",
      rubric: [1, 2, 3, 4, 5],
    },
    category: {
      type: "choice",
      instructions: "Determine the infrastructure or application subsystem responsible for this log event.",
      options: ["database", "network", "auth", "disk_io", "application", "third_party"],
    },
    is_outage: {
      type: "noul",
      instructions: "Does this log message indicate an active customer-facing service outage?",
    },
  },
};

export const useLayaStore = create<LayaStore>((set, get) => ({
  settings: defaultLayaSettings,
  checkpoints: [],
  modelStatus: null,
  isLoading: false,
  isTesting: false,
  testResult: null,
  error: null,

  fetchModelStatus: async (workspaceId?: string) => {
    try {
      const res = await callSidecar<import("@/types/laya").LayaModelStatus>({
        method: "get_laya_model_status",
        params: { workspace_id: workspaceId },
      });
      if (res) {
        set({ modelStatus: res });
      }
    } catch (err: unknown) {
      console.warn("failed to fetch laya model status:", err);
    }
  },

  downloadModel: async (workspaceId?: string) => {
    try {
      const res = await callSidecar<import("@/types/laya").LayaModelStatus>({
        method: "download_laya_model",
        params: { workspace_id: workspaceId },
      });
      if (res) {
        set({ modelStatus: res });
      }

      // Poll status every 1.5 seconds while downloading
      const pollInterval = setInterval(async () => {
        try {
          const status = await callSidecar<import("@/types/laya").LayaModelStatus>({
            method: "get_laya_model_status",
            params: { workspace_id: workspaceId },
          });
          if (status) {
            set({ modelStatus: status });
            if (status.state === "ready" || status.state === "error" || status.state === "idle") {
              clearInterval(pollInterval);
            }
          }
        } catch {
          clearInterval(pollInterval);
        }
      }, 1500);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  fetchSettings: async (workspaceId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await callSidecar<LayaSettings>({
        method: "get_laya_settings",
        params: { workspace_id: workspaceId },
      });
      if (res) {
        set({ settings: res });
      }
      await get().fetchModelStatus(workspaceId);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  updateSettings: async (params: { enabled?: boolean; device?: "cpu" | "gpu"; workspaceId?: string }) => {
    set({ isLoading: true, error: null });
    try {
      const res = await callSidecar<LayaSettings>({
        method: "update_laya_settings",
        params: {
          enabled: params.enabled,
          device: params.device,
          workspace_id: params.workspaceId,
        },
      });
      if (res) {
        set({ settings: res });
      }
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchCheckpoints: async (workspaceId?: string) => {
    try {
      const res = await callSidecar<LayaCheckpoint[]>({
        method: "get_laya_checkpoints",
        params: { workspace_id: workspaceId },
      });
      if (Array.isArray(res)) {
        set({ checkpoints: res });
      }
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  rollbackCheckpoint: async (checkpointId: string, workspaceId?: string) => {
    set({ isLoading: true, error: null });
    try {
      await callSidecar({
        method: "rollback_laya_checkpoint",
        params: {
          checkpoint_id: checkpointId,
          workspace_id: workspaceId,
        },
      });
      await get().fetchSettings(workspaceId);
      await get().fetchCheckpoints(workspaceId);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  saveRules: async (
    author: string,
    description: string,
    questions: Record<string, LayaQuestion>,
    workspaceId?: string,
  ) => {
    set({ isLoading: true, error: null });
    try {
      await callSidecar({
        method: "save_laya_rules",
        params: {
          author,
          description,
          questions,
          workspace_id: workspaceId,
        },
      });
      await get().fetchSettings(workspaceId);
      await get().fetchCheckpoints(workspaceId);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  testRule: async (
    stateText: string,
    questionName?: string,
    question?: LayaQuestion,
    workspaceId?: string,
  ) => {
    set({ isTesting: true, error: null });
    try {
      const result = await callSidecar<LayaDecisionResult>({
        method: "test_laya_rule",
        params: {
          state_text: stateText,
          question_name: questionName,
          question,
          workspace_id: workspaceId,
        },
      });
      set({ testResult: result });
      return result;
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return null;
    } finally {
      set({ isTesting: false });
    }
  },

  clearTestResult: () => {
    set({ testResult: null });
  },
}));
