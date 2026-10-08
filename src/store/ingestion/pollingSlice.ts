import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { toast } from "sonner";
import type { StateCreator } from "zustand";
import { traceIngestion } from "./trace";
import type {
  IngestionJob,
  IngestionStore,
  PollingActions,
  PollingState,
  WorkspacePollSession,
} from "./types";

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

export const initialPollingState: PollingState = {
  jobs: [],
  activeJob: null,
  lastJob: null,
  isPolling: false,
  liveSourceCount: 0,
};

export const createPollingSlice: StateCreator<
  IngestionStore,
  [],
  [],
  PollingState & PollingActions
> = (set, get) => ({
  ...initialPollingState,

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

      const { notifiedJobIds: prevNotified, jobs: prevJobs } = get();
      const nextNotified = new Set(prevNotified);

      for (const job of fetchedJobs) {
        if (job.status === "completed" || job.status === "failed") {
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
                  // Step 2: Request workspace hierarchy refresh via event to avoid circular store import
                  traceIngestion(
                    "[Store] Completion Step 2: Triggering workspace hierarchy refresh event...",
                  );
                  globalThis.dispatchEvent(
                    new CustomEvent("loglens:refresh-hierarchy", {
                      detail: { workspaceId: completedWorkspaceId },
                    }),
                  );

                  // Step 3: Clear completed job state from store
                  traceIngestion("[Store] Completion Step 3: Clearing completed state...");
                  get().clearCompletedState(completedWorkspaceId, completedSourceId);

                  // Step 4: Stop ingestion tracking
                  traceIngestion("[Store] Completion Step 4: Stopping ingestion...");
                  get().stopIngestion(completedSourceId);

                  // Dispatch refresh logs event
                  traceIngestion(
                    "[Store] Completion Step 5: Dispatching loglens:refresh-logs event.",
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

              get().stopIngestion(job.source_id);
            }
          } else {
            nextNotified.add(job.id);
          }
        }
      }

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

      const globalActiveJob =
        combinedJobs.find(
          (j) => j.status === "processing" || j.status === "pending" || j.status === "queued",
        ) ?? null;

      traceIngestion(
        `[Store] fetchJobs: Merged jobs result: count=${combinedJobs.length}, activeJob=${globalActiveJob?.id ?? "none"} (status: ${globalActiveJob?.status ?? "none"}).`,
      );

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

    session.sessionId += 1;
    const currentSessionId = session.sessionId;

    traceIngestion(
      `[Store] startPolling: Initializing session for workspaceId=${workspaceId}, sessionId=${currentSessionId}`,
    );

    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }

    set({ isPolling: true });

    const schedule = async () => {
      await get().fetchJobs(workspaceId);

      const { useClusteringStore } = await import("../clusteringStore");
      useClusteringStore.getState().fetchStatus(workspaceId);

      const currentSession = pollSessions.get(workspaceId);
      if (!currentSession || currentSession.sessionId !== currentSessionId) {
        return;
      }

      const { activeJob, liveSourceCount } = get();

      const wsActiveJob = get().jobs.find(
        (j) =>
          j.workspace_id === workspaceId &&
          (j.status === "processing" || j.status === "pending" || j.status === "queued"),
      );

      if (!wsActiveJob && liveSourceCount === 0) {
        const anyActive = [...pollSessions.values()].some((s) => s.timer !== null);
        if (!anyActive) {
          set({ isPolling: false });
        }
        currentSession.timer = null;
        return;
      }

      const delay =
        activeJob?.status === "processing" || activeJob?.status === "pending"
          ? POLL_ACTIVE_MS
          : POLL_LIVE_MS;

      currentSession.timer = setTimeout(schedule, delay);
    };

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
        ingestingSourceIds: state.ingestingSourceIds,
      };
    });
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
      const activeJobs = state.jobs.filter(
        (j) => j.status === "queued" || j.status === "pending" || j.status === "processing",
      );

      const active = activeJobs.find(
        (j) => j.status === "processing" || j.status === "pending" || j.status === "queued",
      );

      const activeSourceIds = activeJobs.map((j) => j.source_id);
      const nextIngesting = state.ingestingSourceIds.filter((id) => activeSourceIds.includes(id));

      return {
        jobs: activeJobs,
        activeJob: active ?? null,
        lastJob: activeJobs[0] ?? null,
        error: null,
        ingestingSourceIds: nextIngesting,
        transitioningSourceIds: state.transitioningSourceIds,
        notifiedJobIds: state.notifiedJobIds,
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
});
