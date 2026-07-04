import { useMemo } from "react";
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
  const jobs = useIngestionStore(
    useShallow((state) => state.jobs.filter((j) => j.workspace_id === workspaceId)),
  );

  const activeJob = useMemo(
    () =>
      jobs.find(
        (j) => j.status === "queued" || j.status === "pending" || j.status === "processing",
      ) || null,
    [jobs],
  );

  const lastJob = useMemo(() => jobs[0] || null, [jobs]);

  return { activeJob, lastJob, jobs };
}
