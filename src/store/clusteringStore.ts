import { create } from "zustand";
import { callSidecar } from "../lib/hooks/useSidecarBridge";

export type ClusteringMode = "auto" | "burst";

interface ClusteringStatus {
  mode: ClusteringMode;
  running: boolean;
  paused: boolean;
  backlog: number;
  processed_session: number;
}

interface ClusteringState {
  status: ClusteringStatus | null;
  error: string | null;

  // Actions — no polling; driven externally by ingestionStore when active.
  fetchStatus: (workspaceId?: string) => Promise<void>;
  setMode: (mode: ClusteringMode, workspaceId?: string) => Promise<void>;
  setPaused: (paused: boolean, workspaceId?: string) => Promise<void>;
}

export const useClusteringStore = create<ClusteringState>((set, get) => ({
  status: null,
  error: null,

  fetchStatus: async (workspaceId) => {
    try {
      const response = await callSidecar("get_clustering_status", {
        workspace_id: workspaceId,
      });
      set({ status: response as ClusteringStatus, error: null });
    } catch (err: any) {
      set({ error: err.message || "Failed to fetch clustering status" });
    }
  },

  setMode: async (mode, workspaceId) => {
    try {
      await callSidecar("set_clustering_mode", { mode, workspace_id: workspaceId });
      const currentStatus = get().status;
      if (currentStatus) {
        set({ status: { ...currentStatus, mode, paused: false } });
      }
      await get().fetchStatus(workspaceId);
    } catch (err: any) {
      set({ error: err.message || "Failed to set clustering mode" });
    }
  },

  setPaused: async (paused, workspaceId) => {
    try {
      await callSidecar("set_clustering_paused", { paused, workspace_id: workspaceId });
      const currentStatus = get().status;
      if (currentStatus) {
        set({ status: { ...currentStatus, paused } });
      }
      await get().fetchStatus(workspaceId);
    } catch (err: any) {
      set({ error: err.message || "Failed to toggle clustering" });
    }
  },
}));
