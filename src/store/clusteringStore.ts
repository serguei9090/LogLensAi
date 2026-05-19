import { create } from "zustand";
import { callSidecar } from "../lib/hooks/useSidecarBridge";

export type ClusteringMode = "auto" | "burst";

/** Interval (ms) when the worker has a backlog to drain. */
const POLL_ACTIVE_MS = 2_000;
/** Interval (ms) when the worker is idle — no pending lines. */
const POLL_IDLE_MS = 15_000;

interface ClusteringStatus {
  mode: ClusteringMode;
  running: boolean;
  paused: boolean;
  backlog: number;
  processed_session: number;
}

interface ClusteringState {
  status: ClusteringStatus | null;
  isPolling: boolean;
  error: string | null;

  // Actions
  fetchStatus: (workspaceId?: string) => Promise<void>;
  setMode: (mode: ClusteringMode, workspaceId?: string) => Promise<void>;
  setPaused: (paused: boolean, workspaceId?: string) => Promise<void>;
  startPolling: (workspaceId?: string) => void;
  stopPolling: () => void;
}

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let pollSessionId = 0;

export const useClusteringStore = create<ClusteringState>((set, get) => ({
  status: null,
  isPolling: false,
  error: null,

  fetchStatus: async (workspaceId) => {
    try {
      const response = await callSidecar("get_clustering_status", { workspace_id: workspaceId });
      set({ status: response as ClusteringStatus, error: null });
    } catch (err: any) {
      set({ error: err.message || "Failed to fetch clustering status" });
      console.error("Clustering store fetch error:", err);
    }
  },

  setMode: async (mode, workspaceId) => {
    try {
      await callSidecar("set_clustering_mode", { mode, workspace_id: workspaceId });
      // Proactively update local state
      const currentStatus = get().status;
      if (currentStatus) {
        set({ status: { ...currentStatus, mode, paused: false } });
      }
      // Re-fetch to confirm
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

  startPolling: (workspaceId) => {
    if (get().isPolling) {
      return;
    }

    set({ isPolling: true });
    const currentSession = ++pollSessionId;

    // Adaptive polling loop: fast when work is pending, slow when idle.
    const schedule = async () => {
      await get().fetchStatus(workspaceId);

      if (currentSession !== pollSessionId || !get().isPolling) {
        return;
      }

      const { status } = get();
      // Active when worker is running with pending backlog
      const isActive = status?.running && (status?.backlog ?? 0) > 0;
      const delay = isActive ? POLL_ACTIVE_MS : POLL_IDLE_MS;
      pollTimer = setTimeout(schedule, delay);
    };

    // Immediate first fetch, then schedule
    schedule();
  },

  stopPolling: () => {
    pollSessionId++; // Invalidate any running async loop instantly
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    set({ isPolling: false });
  },
}));
