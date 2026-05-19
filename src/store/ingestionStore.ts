import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { create } from "zustand";

export interface IngestionJob {
  id: number;
  workspace_id: string;
  source_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_lines: number;
  processed_lines: number;
  created_at: string;
  updated_at: string;
}

interface IngestionState {
  jobs: IngestionJob[];
  activeJob: IngestionJob | null;
  lastJob: IngestionJob | null;
  isPolling: boolean;
  error: string | null;

  // Actions
  fetchJobs: (workspaceId: string) => Promise<void>;
  startPolling: (workspaceId: string) => void;
  stopPolling: () => void;
  clearState: () => void;
}

/** Interval (ms) when an ingestion job is actively processing. */
const POLL_ACTIVE_MS = 1_000;
/** Interval (ms) when no jobs are active — prevents redundant RPC calls. */
const POLL_IDLE_MS = 15_000;

let pollingInterval: ReturnType<typeof setTimeout> | null = null;
let pollSessionId = 0;

export const useIngestionStore = create<IngestionState>((set, get) => ({
  jobs: [],
  activeJob: null,
  lastJob: null,
  isPolling: false,
  error: null,

  fetchJobs: async (workspaceId: string) => {
    if (!workspaceId) {
      return;
    }

    try {
      const fetchedJobs = await callSidecar<IngestionJob[]>({
        method: "get_ingestion_jobs",
        params: { workspace_id: workspaceId },
        silent: true,
      });

      const active = fetchedJobs.find((j) => j.status === "processing" || j.status === "pending");
      const mostRecent = fetchedJobs[0] || null;

      set({
        jobs: fetchedJobs,
        activeJob: active || null,
        lastJob: mostRecent,
        error: null,
      });
    } catch (err) {
      console.error("Failed to fetch ingestion jobs:", err);
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  startPolling: (workspaceId: string) => {
    if (get().isPolling) {
      return;
    }

    set({ isPolling: true });
    const currentSession = ++pollSessionId;

    // Immediate fetch
    get().fetchJobs(workspaceId);

    // Dynamic polling loop using a safer approach
    const poll = async () => {
      await get().fetchJobs(workspaceId);

      if (currentSession !== pollSessionId || !get().isPolling) {
        return;
      }

      const { activeJob } = get();
      // Adaptive frequency: fast while processing, slow when idle
      const interval = activeJob ? POLL_ACTIVE_MS : POLL_IDLE_MS;
      pollingInterval = setTimeout(poll, interval) as any;
    };

    pollingInterval = setTimeout(poll, 1000) as any;
  },

  stopPolling: () => {
    pollSessionId++; // Invalidate any running async loop
    if (pollingInterval) {
      clearTimeout(pollingInterval);
      pollingInterval = null;
    }
    set({ isPolling: false });
  },

  clearState: () => {
    set({
      jobs: [],
      activeJob: null,
      lastJob: null,
      error: null,
    });
  },
}));
