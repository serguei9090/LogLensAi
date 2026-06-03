import { create } from "zustand";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unreachable";
  uptime: number;
  hydration: {
    misses: number;
    quarantine_size: number;
  };
  workers: {
    clustering: boolean;
    ingestion: boolean;
  };
  lastUpdate: number;
}

interface HealthStore {
  health: HealthStatus | null;
  isPolling: boolean;
  error: string | null;
  fetchHealth: () => Promise<void>;
  setPolling: (isPolling: boolean) => void;
}

export const useHealthStore = create<HealthStore>((set) => ({
  health: null,
  isPolling: false,
  error: null,

  fetchHealth: async () => {
    try {
      const res = await callSidecar<
        Omit<HealthStatus, "lastUpdate" | "status"> & { status: string }
      >("get_health", {});

      let overallStatus: HealthStatus["status"] = "healthy";
      if (!res.workers.clustering || !res.workers.ingestion || res.hydration.misses > 100) {
        overallStatus = "degraded";
      }

      set({
        health: {
          ...res,
          status: overallStatus,
          lastUpdate: Date.now(),
        } as HealthStatus,
        error: null,
      });
    } catch (err: any) {
      set({
        health: {
          status: "unreachable",
          uptime: 0,
          hydration: { misses: 0, quarantine_size: 0 },
          workers: { clustering: false, ingestion: false },
          lastUpdate: Date.now(),
        },
        error: err.message || "Failed to reach sidecar",
      });
    }
  },

  setPolling: (isPolling) => set({ isPolling }),
}));
