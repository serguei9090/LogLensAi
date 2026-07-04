import { useShallow } from "zustand/react/shallow";
import { useIngestionStore } from "@/store/ingestionStore";

export type { IngestionJob } from "@/store/ingestionStore";

/**
 * Read-only hook to observe ingestion job state.
 *
 * Polling is NOT started here. It is driven exclusively by useLogIngestion
 * when an explicit ingest action fires (upload, tail, SSH, stream).
 * This eliminates idle RPC calls on page mount.
 */
export function useIngestionStatus(workspaceId: string) {
  return useIngestionStore(
    useShallow((state) => {
      const jobs = state.jobs.filter((j) => j.workspace_id === workspaceId);
      const activeJob =
        jobs.find(
          (j) => j.status === "queued" || j.status === "pending" || j.status === "processing",
        ) || null;
      const lastJob = jobs[0] || null;
      return { activeJob, lastJob, jobs };
    }),
  );
}
