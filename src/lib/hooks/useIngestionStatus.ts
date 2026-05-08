import { useEffect, useState } from "react";
import { callSidecar } from "./useSidecarBridge";

export interface IngestionJob {
  id: number;
  workspace_id: string;
  source_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_lines: number;
  processed_lines: number;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to monitor the status of log ingestion jobs for a specific workspace.
 * Polls the backend every 500ms while a job is active.
 */
export function useIngestionStatus(workspaceId: string) {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [activeJob, setActiveJob] = useState<IngestionJob | null>(null);
  const [lastJob, setLastJob] = useState<IngestionJob | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    let isMounted = true;
    let timer: ReturnType<typeof setTimeout>;

    const checkStatus = async () => {
      try {
        const fetchedJobs = await callSidecar<IngestionJob[]>({
          method: "get_ingestion_jobs",
          params: { workspace_id: workspaceId },
          silent: true,
        });

        if (!isMounted) return;

        setJobs(fetchedJobs);

        // The API returns jobs sorted by created_at DESC
        const mostRecent = fetchedJobs[0] || null;
        setLastJob(mostRecent);

        // Find the most recent active job (processing or pending)
        const active = fetchedJobs.find((j) => j.status === "processing" || j.status === "pending");
        setActiveJob(active || null);

        // Adaptive polling: faster when a job is active, slower when idle
        const interval = active ? 500 : 3000;
        timer = setTimeout(checkStatus, interval);
      } catch (error) {
        console.error("Failed to poll ingestion status:", error);
        if (isMounted) {
          timer = setTimeout(checkStatus, 5000); // Retry later on error
        }
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [workspaceId]);

  return { activeJob, lastJob, jobs };
}
