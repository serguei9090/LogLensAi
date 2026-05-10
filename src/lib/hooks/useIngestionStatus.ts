import { useIngestionStore } from "@/store/ingestionStore";
import { useEffect } from "react";

export type { IngestionJob } from "@/store/ingestionStore";

/**
 * Hook to monitor the status of log ingestion jobs for a specific workspace.
 * Now uses the central ingestionStore for efficient, shared polling.
 */
export function useIngestionStatus(workspaceId: string) {
  const { jobs, activeJob, lastJob, startPolling, stopPolling } = useIngestionStore();

  useEffect(() => {
    if (workspaceId) {
      startPolling(workspaceId);
    }
    return () => {
      stopPolling();
    };
  }, [workspaceId, startPolling, stopPolling]);

  return { activeJob, lastJob, jobs };
}
