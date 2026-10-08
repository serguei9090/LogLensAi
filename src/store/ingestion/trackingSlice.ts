import type { StateCreator } from "zustand";
import { traceIngestion } from "./trace";
import type { IngestionStore, TrackingActions, TrackingState } from "./types";

export const initialTrackingState: TrackingState = {
  error: null,
  ingestingSourceIds: [],
  transitioningSourceIds: new Set<string>(),
  notifiedJobIds: new Set<number>(),
  handledJobIds: new Set<number>(),
  retrievingSourceIds: new Set<string>(),
};

export const createTrackingSlice: StateCreator<
  IngestionStore,
  [],
  [],
  TrackingState & TrackingActions
> = (set, get) => ({
  ...initialTrackingState,

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

  clearTransitioningJobs: () => {
    set(() => ({
      transitioningSourceIds: new Set<string>(),
    }));
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
});
