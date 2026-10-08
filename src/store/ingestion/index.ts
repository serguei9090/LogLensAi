import { create } from "zustand";
import { createImportSlice } from "./importSlice";
import { createPollingSlice } from "./pollingSlice";
import { createTrackingSlice } from "./trackingSlice";
import type { IngestionStore } from "./types";

export * from "./importSlice";
export * from "./pollingSlice";
export * from "./trace";
export * from "./trackingSlice";
export * from "./types";

export const useIngestionStore = create<IngestionStore>((...args) => ({
  ...createImportSlice(...args),
  ...createTrackingSlice(...args),
  ...createPollingSlice(...args),
}));

// Listen for cross-store source job cleanup without circular imports
if (typeof globalThis !== "undefined" && globalThis.addEventListener) {
  globalThis.addEventListener("loglens:remove-source-jobs", ((
    e: CustomEvent<{ sourceId: string }>,
  ) => {
    if (e.detail?.sourceId) {
      useIngestionStore.getState().removeJobsForSource(e.detail.sourceId);
    }
  }) as EventListener);
}
