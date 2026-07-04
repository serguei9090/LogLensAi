import { toast } from "sonner";
import { create } from "zustand";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";

export interface IngestionJob {
  id: number;
  workspace_id: string;
  source_id: string;
  status: "queued" | "pending" | "processing" | "completed" | "failed";
  total_lines: number;
  processed_lines: number;
  /** 1-based position in the active queue. 0 = not queued (completed/failed). */
  queue_position: number;
  created_at: string;
  updated_at: string;
}

interface WorkspacePollSession {
  sessionId: number;
  timer: ReturnType<typeof setTimeout> | null;
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
  /**
   * Per-source IDs that are transitioning (between callSidecar returning and
   * the first poll detecting a job). A Set so multiple simultaneous uploads
   * are each tracked independently without overwriting each other.
   */
  transitioningSourceIds: Set<string>;
  /** Tracks job IDs that have already triggered a completed/failed notification. */
  notifiedJobIds: Set<number>;

  // Import Feed Modal Global States
  isImportOpen: boolean;
  isImportProcessing: boolean;
  importActiveTab: "local" | "ssh" | "manual" | "live";
  importLocalPath: string;
  importLocalTail: boolean;
  importSshHost: string;
  importSshPort: string;
  importSshUser: string;
  importSshPass: string;
  importSshPath: string;
  importSshTail: boolean;
  importManualLogs: string;
  importLiveName: string;
  importLiveSyslog: boolean;
  importLiveHttp: boolean;

  // Actions
  setImportOpen: (open: boolean) => void;
  setImportProcessing: (processing: boolean) => void;
  setImportActiveTab: (tab: "local" | "ssh" | "manual" | "live") => void;
  setImportLocalPath: (path: string) => void;
  setImportLocalTail: (tail: boolean) => void;
  setImportSshHost: (host: string) => void;
  setImportSshPort: (port: string) => void;
  setImportSshUser: (user: string) => void;
  setImportSshPass: (pass: string) => void;
  setImportSshPath: (path: string) => void;
  setImportSshTail: (tail: boolean) => void;
  setImportManualLogs: (logs: string) => void;
  setImportLiveName: (name: string) => void;
  setImportLiveSyslog: (syslog: boolean) => void;
  setImportLiveHttp: (http: boolean) => void;
  resetImportForm: () => void;

  fetchJobs: (workspaceId: string) => Promise<void>;
  /**
   * Start (or restart) the polling loop for a workspace.
   * Each workspace has its own independent session so uploads to workspace B
   * do NOT cancel the polling session for workspace A.
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
  addTransitioningSource: (sourceId: string) => void;
  removeTransitioningSource: (sourceId: string) => void;
  clearTransitioningJobs: () => void;
  addOrUpdateJob: (job: IngestionJob) => void;
  clearCompletedState: (workspaceId: string, sourceId: string) => void;
  clearState: () => void;
  removeJobsForSource: (sourceId: string) => void;
}

/** Interval (ms) when an ingestion job is actively processing. */
const POLL_ACTIVE_MS = 1_000;
/** Interval (ms) when a live source is open but no job is queued yet. */
const POLL_LIVE_MS = 3_000;

/**
 * Per-workspace poll sessions. Keyed by workspaceId.
 * Module-level map (not in Zustand state) to avoid re-render cycles from timers.
 */
const pollSessions = new Map<string, WorkspacePollSession>();

function getOrCreateSession(workspaceId: string): WorkspacePollSession {
  if (!pollSessions.has(workspaceId)) {
    pollSessions.set(workspaceId, { sessionId: 0, timer: null });
  }
  return pollSessions.get(workspaceId) as WorkspacePollSession;
}

export const useIngestionStore = create<IngestionState>((set, get) => ({
  jobs: [],
  activeJob: null,
  lastJob: null,
  isPolling: false,
  liveSourceCount: 0,
  error: null,
  ingestingSourceIds: [],
  transitioningSourceIds: new Set<string>(),
  notifiedJobIds: new Set<number>(),

  // Import Modal Initial States
  isImportOpen: false,
  isImportProcessing: false,
  importActiveTab: "local",
  importLocalPath: "",
  importLocalTail: false,
  importSshHost: "",
  importSshPort: "22",
  importSshUser: "",
  importSshPass: "",
  importSshPath: "",
  importSshTail: false,
  importManualLogs: "",
  importLiveName: "",
  importLiveSyslog: true,
  importLiveHttp: true,

  setImportOpen: (open) => set({ isImportOpen: open }),
  setImportProcessing: (processing) => set({ isImportProcessing: processing }),
  setImportActiveTab: (tab) => set({ importActiveTab: tab }),
  setImportLocalPath: (path) => set({ importLocalPath: path }),
  setImportLocalTail: (tail) => set({ importLocalTail: tail }),
  setImportSshHost: (host) => set({ importSshHost: host }),
  setImportSshPort: (port) => set({ importSshPort: port }),
  setImportSshUser: (user) => set({ importSshUser: user }),
  setImportSshPass: (pass) => set({ importSshPass: pass }),
  setImportSshPath: (path) => set({ importSshPath: path }),
  setImportSshTail: (tail) => set({ importSshTail: tail }),
  setImportManualLogs: (logs) => set({ importManualLogs: logs }),
  setImportLiveName: (name) => set({ importLiveName: name }),
  setImportLiveSyslog: (syslog) => set({ importLiveSyslog: syslog }),
  setImportLiveHttp: (http) => set({ importLiveHttp: http }),
  resetImportForm: () =>
    set({
      importLocalPath: "",
      importLocalTail: false,
      importSshHost: "",
      importSshPort: "22",
      importSshUser: "",
      importSshPass: "",
      importSshPath: "",
      importSshTail: false,
      importManualLogs: "",
      importLiveName: "",
      importLiveSyslog: true,
      importLiveHttp: true,
      importActiveTab: "local",
    }),

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

      const active = fetchedJobs.find(
        (j) => j.status === "processing" || j.status === "pending" || j.status === "queued",
      );

      const { notifiedJobIds: prevNotified, jobs: prevJobs, ingestingSourceIds } = get();
      const nextNotified = new Set(prevNotified);
      const finishedSourceIds: string[] = [];

      for (const job of fetchedJobs) {
        if (job.status === "completed" || job.status === "failed") {
          // Check if this job transitioned from active to done
          const prevJob = prevJobs.find((j) => j.id === job.id);
          const wasActive =
            prevJob &&
            (prevJob.status === "processing" ||
              prevJob.status === "queued" ||
              prevJob.status === "pending");

          if (wasActive && !nextNotified.has(job.id)) {
            nextNotified.add(job.id);
            if (job.status === "completed") {
              console.log(
                `[useIngestionStore] Ingestion COMPLETE for job ${job.id} (source: ${job.source_id})`,
              );
            } else {
              console.log(
                `[useIngestionStore] Ingestion FAILED for job ${job.id} (source: ${job.source_id})`,
              );
              toast.error("Ingestion failed", {
                id: "ingest",
                description: "Check sidecar logs for details.",
              });
            }
          } else {
            // Silently mark existing completed jobs as notified
            nextNotified.add(job.id);
          }
          finishedSourceIds.push(job.source_id);
        }
      }

      set({
        jobs: fetchedJobs,
        activeJob: active ?? null,
        lastJob: fetchedJobs[0] ?? null,
        error: null,
        ingestingSourceIds, // Keep ingestingSourceIds as is; let the page handle stopIngestion
        notifiedJobIds: nextNotified,
      });
    } catch (err) {
      console.error("Failed to fetch ingestion jobs:", err);
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  startPolling: (workspaceId: string) => {
    const session = getOrCreateSession(workspaceId);

    // Increment session ID to invalidate any in-flight tick from the old session.
    session.sessionId += 1;
    const currentSessionId = session.sessionId;

    // Cancel any pending timer for this workspace.
    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }

    set({ isPolling: true });

    const schedule = async () => {
      await get().fetchJobs(workspaceId);

      // Co-drive clustering status refresh while work is in-flight.
      const { useClusteringStore } = await import("./clusteringStore");
      useClusteringStore.getState().fetchStatus(workspaceId);

      // Session was superseded by a newer startPolling call for this workspace — abort.
      const currentSession = pollSessions.get(workspaceId);
      if (!currentSession || currentSession.sessionId !== currentSessionId) {
        return;
      }

      const { activeJob, liveSourceCount } = get();

      // Self-terminate: nothing left to watch for this workspace.
      if (!activeJob && liveSourceCount === 0) {
        // Only clear isPolling if NO workspace is still actively polling
        const anyActive = [...pollSessions.values()].some((s) => s.timer !== null);
        if (!anyActive) {
          set({ isPolling: false });
        }
        currentSession.timer = null;
        return;
      }

      // Adaptive interval: fast during active processing, slower during live tail idle.
      const delay =
        activeJob?.status === "processing" || activeJob?.status === "pending"
          ? POLL_ACTIVE_MS
          : POLL_LIVE_MS;

      currentSession.timer = setTimeout(schedule, delay);
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

  addTransitioningSource: (sourceId: string) => {
    set((state) => {
      const next = new Set(state.transitioningSourceIds);
      next.add(sourceId);
      return { transitioningSourceIds: next };
    });
  },

  removeTransitioningSource: (sourceId: string) => {
    set((state) => {
      const next = new Set(state.transitioningSourceIds);
      next.delete(sourceId);
      return { transitioningSourceIds: next };
    });
  },

  addOrUpdateJob: (job: IngestionJob) => {
    set((state) => {
      const exists = state.jobs.some((j) => j.id === job.id);
      const nextJobs = exists
        ? state.jobs.map((j) => (j.id === job.id ? { ...j, ...job } : j))
        : [job, ...state.jobs];

      const active = nextJobs.find(
        (j) => j.status === "processing" || j.status === "pending" || j.status === "queued",
      );

      const nextNotified = new Set(state.notifiedJobIds);

      if (job.status === "completed" || job.status === "failed") {
        const prevJob = state.jobs.find((j) => j.id === job.id);
        const wasActive =
          prevJob &&
          (prevJob.status === "processing" ||
            prevJob.status === "queued" ||
            prevJob.status === "pending");

        if (!nextNotified.has(job.id)) {
          nextNotified.add(job.id);
          if (wasActive) {
            if (job.status === "completed") {
              console.log(
                `[useIngestionStore] addOrUpdateJob Ingestion COMPLETE for job ${job.id} (source: ${job.source_id})`,
              );
            } else {
              console.log(
                `[useIngestionStore] addOrUpdateJob Ingestion FAILED for job ${job.id} (source: ${job.source_id})`,
              );
              toast.error("Ingestion failed", {
                id: "ingest",
                description: "Check sidecar logs for details.",
              });
            }
          }
        }
      }
      return {
        jobs: nextJobs,
        activeJob: active ?? null,
        lastJob: nextJobs[0] ?? null,
        notifiedJobIds: nextNotified,
        ingestingSourceIds: state.ingestingSourceIds, // Keep ingestingSourceIds as is; let the page handle stopIngestion
      };
    });
  },

  clearTransitioningJobs: () => {
    set(() => ({
      transitioningSourceIds: new Set<string>(),
    }));
  },

  clearCompletedState: (workspaceId: string, sourceId: string) => {
    set((state) => {
      const nextJobs = state.jobs.filter(
        (j) =>
          !(
            j.workspace_id === workspaceId &&
            j.source_id === sourceId &&
            (j.status === "completed" || j.status === "failed")
          ),
      );
      const active = nextJobs.find(
        (j) => j.status === "processing" || j.status === "pending" || j.status === "queued",
      );
      return {
        jobs: nextJobs,
        activeJob: active ?? null,
        lastJob: nextJobs[0] ?? null,
      };
    });
  },

  clearState: () => {
    set((state) => {
      // Keep jobs that are still actively running (queued, pending, processing)
      const activeJobs = state.jobs.filter(
        (j) => j.status === "queued" || j.status === "pending" || j.status === "processing",
      );

      const active = activeJobs.find(
        (j) => j.status === "processing" || j.status === "pending" || j.status === "queued",
      );

      // Keep ingestingSourceIds that have active jobs or are transitioning
      const activeSourceIds = activeJobs.map((j) => j.source_id);
      const nextIngesting = state.ingestingSourceIds.filter((id) => activeSourceIds.includes(id));

      return {
        jobs: activeJobs,
        activeJob: active ?? null,
        lastJob: activeJobs[0] ?? null,
        error: null,
        ingestingSourceIds: nextIngesting,
        transitioningSourceIds: state.transitioningSourceIds, // Keep transitions
        notifiedJobIds: state.notifiedJobIds, // Keep notified log records to prevent double toast alerts or state changes
      };
    });
  },

  removeJobsForSource: (sourceId) => {
    set((state) => {
      const nextJobs = state.jobs.filter((j) => j.source_id !== sourceId);
      const active = nextJobs.find(
        (j) => j.status === "processing" || j.status === "pending" || j.status === "queued",
      );
      return {
        jobs: nextJobs,
        activeJob: active ?? null,
        lastJob: nextJobs[0] ?? null,
      };
    });
  },
}));
