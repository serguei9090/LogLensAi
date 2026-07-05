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
  /**
   * Tracks job IDs whose completion has already been fully handled by
   * InvestigationPage (hierarchy refresh + log fetch + overlay drop).
   * Stored in global Zustand so the Set survives InvestigationPage unmounting
   * (e.g. when the user navigates to Dashboard and returns).
   * Without this, the component-local ref was destroyed on unmount and the
   * completion handler re-fired on every remount, instantly clearing the overlay.
   */
  handledJobIds: Set<number>;
  /** Tracks sources whose job just completed but fetchLogs hasn't returned data yet. */
  retrievingSourceIds: Set<string>;

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
  /** Mark a job as fully handled so remounts don't re-process it. */
  markJobHandled: (jobId: number) => void;
  /** Return true if this job has already been fully processed. */
  isJobHandled: (jobId: number) => boolean;
  /**
   * Clear the handled-job tracking for a specific source so that re-importing
   * the same file (which creates a new job ID) triggers the overlay correctly.
   */
  clearHandledJobsForSource: (sourceId: string) => void;
}

/** Interval (ms) when an ingestion job is actively processing. */
const POLL_ACTIVE_MS = 1_000;
/** Interval (ms) when a live source is open but no job is queued yet. */
const POLL_LIVE_MS = 3_000;

export const traceIngestion = async (message: string) => {
  try {
    await callSidecar("log_trace", { message });
  } catch (e) {
    console.warn("Failed to write to ingestion trace log:", e);
  }
};

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
  handledJobIds: new Set<number>(),
  retrievingSourceIds: new Set<string>(),

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
    traceIngestion(
      `[Store] fetchJobs: Called for workspaceId=${workspaceId}. Current ingestingSourceIds=${JSON.stringify(get().ingestingSourceIds)}, transitioningSourceIds=${JSON.stringify(Array.from(get().transitioningSourceIds))}, retrievingSourceIds=${JSON.stringify(Array.from(get().retrievingSourceIds))}`,
    );
    try {
      const fetchedJobs = await callSidecar<IngestionJob[]>({
        method: "get_ingestion_jobs",
        params: { workspace_id: workspaceId },
        silent: true,
      });

      // (no longer needed: activeJob is derived from combinedJobs below)

      const { notifiedJobIds: prevNotified, jobs: prevJobs } = get();
      const nextNotified = new Set(prevNotified);

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
              traceIngestion(
                `[Store] fetchJobs: Detected job ${job.id} (source: ${job.source_id}) complete! Starting completion handler sequence.`,
              );

              // Run global job completion handler logic
              const completedSourceId = job.source_id;
              const completedWorkspaceId = job.workspace_id;

              // Step 1: Mark as retrieving globally
              set((state) => {
                const next = new Set(state.retrievingSourceIds);
                next.add(completedSourceId);
                return { retrievingSourceIds: next };
              });
              traceIngestion(
                `[Store] Completion Step 1: Marked retrievingSourceIds globally for source=${completedSourceId}.`,
              );

              (async () => {
                try {
                  // Step 2: Refresh hierarchy
                  traceIngestion(`[Store] Completion Step 2: Fetching workspace hierarchy...`);
                  const { useWorkspaceStore } = await import("@/store/workspaceStore");
                  await useWorkspaceStore.getState().fetchHierarchy(completedWorkspaceId);
                  traceIngestion(`[Store] Completion Step 2: Workspace hierarchy fetched.`);

                  // Step 3: Clear completed job state from store
                  traceIngestion(`[Store] Completion Step 3: Clearing completed state...`);
                  get().clearCompletedState(completedWorkspaceId, completedSourceId);

                  // Step 4: Stop ingestion tracking
                  traceIngestion(`[Store] Completion Step 4: Stopping ingestion...`);
                  get().stopIngestion(completedSourceId);

                  // Dispatch refresh logs event
                  traceIngestion(
                    `[Store] Completion Step 5: Dispatching loglens:refresh-logs event.`,
                  );
                  globalThis.dispatchEvent(new CustomEvent("loglens:refresh-logs"));
                } catch (e) {
                  console.error("[useIngestionStore] Error in global completion handler:", e);
                  traceIngestion(
                    `[Store] Completion Handler Error: ${e instanceof Error ? e.message : String(e)}`,
                  );
                } finally {
                  // Step 5: Remove retrieving after a brief grace period
                  setTimeout(() => {
                    set((state) => {
                      const next = new Set(state.retrievingSourceIds);
                      next.delete(completedSourceId);
                      return { retrievingSourceIds: next };
                    });
                    get().stopIngestion(completedSourceId);
                  }, 300);
                }
              })();
            } else {
              console.log(
                `[useIngestionStore] Ingestion FAILED for job ${job.id} (source: ${job.source_id})`,
              );
              toast.error("Ingestion failed", {
                id: "ingest",
                description: "Check sidecar logs for details.",
              });

              // Cleanup even on failure
              get().stopIngestion(job.source_id);
            }
          } else {
            // Silently mark existing completed jobs as notified
            nextNotified.add(job.id);
          }
        }
      }

      // Merge fetched jobs with existing jobs for this workspace to prevent race conditions
      // (e.g. an in-flight poll resolving after a new job was added locally but before the
      // sidecar's get_ingestion_jobs returns it).
      // We keep any local jobs that are still active (queued, pending, processing) and not in the fetched list.
      const currentWorkspaceJobs = prevJobs.filter((j) => j.workspace_id === workspaceId);
      const otherWorkspacesJobs = prevJobs.filter((j) => j.workspace_id !== workspaceId);

      const mergedCurrentJobs = [...fetchedJobs];
      for (const localJob of currentWorkspaceJobs) {
        const isFetched = fetchedJobs.some((fj) => fj.id === localJob.id);
        const isActive =
          localJob.status === "queued" ||
          localJob.status === "pending" ||
          localJob.status === "processing";

        if (!isFetched && isActive) {
          mergedCurrentJobs.push(localJob);
        }
      }

      const combinedJobs = [...otherWorkspacesJobs, ...mergedCurrentJobs];

      // activeJob must reflect ANY active job across ALL workspaces so the poll
      // termination check in startPolling does not prematurely kill a session
      // while another workspace is still ingesting.
      const globalActiveJob =
        combinedJobs.find(
          (j) => j.status === "processing" || j.status === "pending" || j.status === "queued",
        ) ?? null;

      traceIngestion(
        `[Store] fetchJobs: Merged jobs result: count=${combinedJobs.length}, activeJob=${globalActiveJob?.id ?? "none"} (status: ${globalActiveJob?.status ?? "none"}).`,
      );

      // IMPORTANT: Do NOT include ingestingSourceIds in this set() call.
      // fetchJobs is async — reading ingestingSourceIds at the top of the function
      // and writing it back here would OVERWRITE any startIngestion() calls that
      // fired concurrently during the await (e.g. a second file upload starting
      // while the poll was in-flight). Omitting the key means Zustand preserves
      // the current value via shallow merge.
      set({
        jobs: combinedJobs,
        activeJob: globalActiveJob,
        lastJob: fetchedJobs[0] ?? null,
        error: null,
        notifiedJobIds: nextNotified,
      });
    } catch (err) {
      console.error("Failed to fetch ingestion jobs:", err);
      traceIngestion(
        `[Store] fetchJobs: Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  startPolling: (workspaceId: string) => {
    const session = getOrCreateSession(workspaceId);

    // Increment session ID to invalidate any in-flight tick from the old session.
    session.sessionId += 1;
    const currentSessionId = session.sessionId;

    traceIngestion(
      `[Store] startPolling: Initializing session for workspaceId=${workspaceId}, sessionId=${currentSessionId}`,
    );

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

      // Self-terminate: check this workspace specifically has no active jobs.
      // Using get().jobs filtered to this workspace prevents a global activeJob
      // field overwrite from another workspace's poll tick killing this session.
      const wsActiveJob = get().jobs.find(
        (j) =>
          j.workspace_id === workspaceId &&
          (j.status === "processing" || j.status === "pending" || j.status === "queued"),
      );

      if (!wsActiveJob && liveSourceCount === 0) {
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
    traceIngestion(`[Store] startIngestion: Adding sourceId=${sourceId} to ingestingSourceIds`);
    set((state) => ({
      ingestingSourceIds: [...state.ingestingSourceIds.filter((id) => id !== sourceId), sourceId],
    }));
  },

  stopIngestion: (sourceId: string) => {
    traceIngestion(`[Store] stopIngestion: Removing sourceId=${sourceId} from ingestingSourceIds`);
    set((state) => ({
      ingestingSourceIds: state.ingestingSourceIds.filter((id) => id !== sourceId),
    }));
  },

  addTransitioningSource: (sourceId: string) => {
    traceIngestion(
      `[Store] addTransitioningSource: Adding sourceId=${sourceId} to transitioningSourceIds`,
    );
    set((state) => {
      const next = new Set(state.transitioningSourceIds);
      next.add(sourceId);
      return { transitioningSourceIds: next };
    });
  },

  removeTransitioningSource: (sourceId: string) => {
    traceIngestion(
      `[Store] removeTransitioningSource: Removing sourceId=${sourceId} from transitioningSourceIds`,
    );
    set((state) => {
      const next = new Set(state.transitioningSourceIds);
      next.delete(sourceId);
      return { transitioningSourceIds: next };
    });
  },

  addOrUpdateJob: (job: IngestionJob) => {
    traceIngestion(
      `[Store] addOrUpdateJob: Called for job.id=${job.id}, status=${job.status}, source=${job.source_id}`,
    );
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
    traceIngestion(
      `[Store] clearCompletedState: Clearing completed/failed jobs for workspaceId=${workspaceId}, sourceId=${sourceId}`,
    );
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

  markJobHandled: (jobId: number) => {
    set((state) => {
      const next = new Set(state.handledJobIds);
      next.add(jobId);
      return { handledJobIds: next };
    });
  },

  isJobHandled: (jobId: number) => {
    return get().handledJobIds.has(jobId);
  },

  clearHandledJobsForSource: (sourceId: string) => {
    // We need the job list to find which job IDs belong to this source,
    // then remove them from handledJobIds so a re-import of the same file
    // (new job ID) triggers the full completion sequence again.
    // NOTE: since job IDs are globally unique integers this is safe to do
    // even for completed jobs that are no longer in the jobs list — we only
    // clear IDs that ARE still in the store for this source.
    set((state) => {
      const sourceJobIds = new Set(
        state.jobs.filter((j) => j.source_id === sourceId).map((j) => j.id),
      );
      const next = new Set(state.handledJobIds);
      for (const id of sourceJobIds) {
        next.delete(id);
      }
      return { handledJobIds: next };
    });
  },
}));
