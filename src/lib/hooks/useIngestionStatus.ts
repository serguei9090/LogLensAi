import { useIngestionStore } from "@/store/ingestionStore";

export type { IngestionJob } from "@/store/ingestionStore";

/**
 * Read-only hook to observe ingestion job state.
 *
 * Polling is NOT started here. It is driven exclusively by useLogIngestion
 * when an explicit ingest action fires (upload, tail, SSH, stream).
 * This eliminates idle RPC calls on page mount.
 */
export function useIngestionStatus(_workspaceId: string) {
  const jobs = useIngestionStore((state) => state.jobs);
  const activeJob = useIngestionStore((state) => state.activeJob);
  const lastJob = useIngestionStore((state) => state.lastJob);
  return { activeJob, lastJob, jobs };
}
