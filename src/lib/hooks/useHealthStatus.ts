import { useHealthStore } from "@/store/healthStore";
import { useEffect, useRef } from "react";

const POLLING_INTERVAL = 5000; // 5 seconds

/**
 * Hook to manage system health polling.
 * Should be initialized at the root of the application.
 */
export function useHealthStatus() {
  const { fetchHealth, isPolling, setPolling } = useHealthStore();
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
