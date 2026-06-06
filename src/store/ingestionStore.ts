import { create } from "zustand";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";

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
  /** Count of active live sources (tails, SSH streams, syslog/HTTP listeners). */
  liveSourceCount: number;
  error: string | null;
  /** Tracks sources that are currently ingesting or finalizing logs. */
  ingestingSourceIds: string[];

  // Actions
  fetchJobs: (workspaceId: string) => Promise<void>;
  /**
   * Start (or restart) the polling loop for a workspace.
   * Called explicitly by useLogIngestion when an ingest action is triggered.
   * The loop self-terminates when no active jobs remain AND no live sources are open.
   */
  startPolling: (workspaceId: string) => void;
  /**
   * Increment the live source counter (tail / SSH / syslog / HTTP listener opened).
   * Keeps the polling loop alive even when no queued jobs exist.
   */
  addLiveSource: () => void;
  /**
   * Decrement the live source counter (tail / SSH / stream stopped).
   * When it reaches zero and no active job is queued, polling stops automatically.
   */
  removeLiveSource: () => void;
  startIngestion: (sourceId: string) => void;
  stopIngestion: (sourceId: string) => void;
  clearState: () => void;
}

/** Interval (ms) when an ingestion job is actively processing. */
const POLL_ACTIVE_MS = 1_000;
/** Interval (ms) when a live source is open but no job is queued yet. */
const POLL_LIVE_MS = 3_000;

let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let pollSessionId = 0;

export const useIngestionStore = create<IngestionState>((set, get) => ({
  jobs: [],
  activeJob: null,
  lastJob: null,
  isPolling: false,
  liveSourceCount: 0,
  error: null,
  ingestingSourceIds: [],

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
      set({
        jobs: fetchedJobs,
        activeJob: active ?? null,
        lastJob: fetchedJobs[0] ?? null,
        error: null,
      });
    } catch (err) {
      console.error("Failed to fetch ingestion jobs:", err);
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  startPolling: (workspaceId: string) => {
    // Always create a new session — replaces any stale loop cleanly.
    pollSessionId++;
    const currentSession = pollSessionId;
    if (pollingTimer) {
      clearTimeout(pollingTimer);
      pollingTimer = null;
    }
    set({ isPolling: true });

    const schedule = async () => {
      await get().fetchJobs(workspaceId);

      // Co-drive clustering status refresh while work is in-flight.
      // Lazy import breaks the potential circular-dep at bundle time.
      const { useClusteringStore } = await import("./clusteringStore");
      useClusteringStore.getState().fetchStatus(workspaceId);

      // Session was superseded — abort silently.
      if (currentSession !== pollSessionId) {
        return;
      }

      const { activeJob, liveSourceCount } = get();

      // Self-terminate: nothing left to watch.
      if (!activeJob && liveSourceCount === 0) {
        set({ isPolling: false });
        pollingTimer = null;
        return;
      }

      // Adaptive interval: fast during active processing, slower during live tail idle.
      const delay = activeJob ? POLL_ACTIVE_MS : POLL_LIVE_MS;
      pollingTimer = setTimeout(schedule, delay);
    };

    // Fire immediately.
    schedule();
  },

  addLiveSource: () => {
    set((state) => ({ liveSourceCount: state.liveSourceCount + 1 }));
  },

  removeLiveSource: () => {
    set((state) => ({
      liveSourceCount: Math.max(0, state.liveSourceCount - 1),
    }));
  },

  startIngestion: (sourceId: string) => {
    set((state) => ({
      ingestingSourceIds: [...state.ingestingSourceIds.filter((id) => id !== sourceId), sourceId],
    }));
  },

  stopIngestion: (sourceId: string) => {
    set((state) => ({
      ingestingSourceIds: state.ingestingSourceIds.filter((id) => id !== sourceId),
    }));
  },

  clearState: () => {
    set({ jobs: [], activeJob: null, lastJob: null, error: null, ingestingSourceIds: [] });
  },
}));
