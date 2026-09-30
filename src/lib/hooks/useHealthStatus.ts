import { useHealthStore } from "@/store/healthStore";
import { useEffect, useRef } from "react";

// Health is a heartbeat — only needs to detect a crashed sidecar process.
// 30s is sufficient; reduces health RPC calls by ~83% vs the prior 5s interval.
const POLLING_INTERVAL = 30_000;

/**
 * Hook to manage system health polling.
 * Should be initialized at the root of the application.
 */
export function useHealthStatus() {
  const { fetchHealth, setPolling } = useHealthStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initial fetch
    fetchHealth();

    // Start polling
    setPolling(true);

    timerRef.current = setInterval(() => {
      fetchHealth();
    }, POLLING_INTERVAL);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setPolling(false);
    };
  }, [fetchHealth, setPolling]);

  return null;
}
