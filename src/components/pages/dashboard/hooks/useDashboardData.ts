import type { TimeRange } from "@/components/molecules/TimeRangePicker";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardStats } from "../types";

export function useDashboardData(workspaces: any[], activeWorkspace: any) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeBounds, setTimeBounds] = useState<{ min: string; max: string } | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Filter State
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(() => {
    const activeId = useWorkspaceStore.getState().activeWorkspaceId;
    return activeId || "all";
  });
  const [selectedSourceId, setSelectedSourceId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>({ start: "", end: "" });

  const lastFetchedParamsRef = useRef<{
    workspaceId: string;
    sourceId: string;
    start: string;
    end: string;
  } | null>(null);

  // Sync selectedWorkspaceId with activeWorkspace on initial load or deletion fallback
  useEffect(() => {
    const exists = workspaces.some((w) => w.id === selectedWorkspaceId);
    const shouldSync = selectedWorkspaceId === "all" || !exists;
    if (shouldSync) {
      const fallbackId = activeWorkspace?.id ?? workspaces[0]?.id ?? "all";
      if (selectedWorkspaceId !== fallbackId) {
        setSelectedWorkspaceId(fallbackId);
      }
    }
  }, [activeWorkspace, workspaces, selectedWorkspaceId]);

  // Reset selected source, time bounds, and time range to "all" when workspace changes
  useEffect(() => {
    if (selectedWorkspaceId) {
      setSelectedSourceId("all");
      setTimeRange({ start: "", end: "" });
      setTimeBounds(null);
      setIsFirstLoad(true);
    }
  }, [selectedWorkspaceId]);

  const syncTimeBounds = useCallback(
    (
      res: DashboardStats | null,
      params: { workspaceId: string; sourceId: string; start: string; end: string },
    ) => {
      if (res?.time_bounds?.min && res.time_bounds.max) {
        const bounds = { min: res.time_bounds.min, max: res.time_bounds.max };
        if (isFirstLoad) {
          setTimeBounds(bounds);
          // Pre-cache parameters to avoid redundant sync call on subsequent render pass
          lastFetchedParamsRef.current = {
            workspaceId: selectedWorkspaceId,
            sourceId: selectedSourceId,
            start: bounds.min,
            end: bounds.max,
          };
          setTimeRange({ start: bounds.min, end: bounds.max, label: "All Time" });
          setIsFirstLoad(false);
        } else {
          lastFetchedParamsRef.current = params;
        }
      } else if (isFirstLoad) {
        setTimeBounds(null);
        lastFetchedParamsRef.current = {
          workspaceId: selectedWorkspaceId,
          sourceId: selectedSourceId,
          start: "",
          end: "",
        };
        setTimeRange({ start: "", end: "" });
        setIsFirstLoad(false);
      } else {
        lastFetchedParamsRef.current = params;
      }
    },
    [isFirstLoad, selectedWorkspaceId, selectedSourceId],
  );

  const fetchStats = useCallback(
    async (force = false) => {
      const params = {
        workspaceId: selectedWorkspaceId,
        sourceId: selectedSourceId,
        start: isFirstLoad ? "" : timeRange.start || "",
        end: isFirstLoad ? "" : timeRange.end || "",
      };

      // Skip if parameters are identical to last fetch (unless forced)
      const current = lastFetchedParamsRef.current;
      if (
        !force &&
        current?.workspaceId === params.workspaceId &&
        current?.sourceId === params.sourceId &&
        current?.start === params.start &&
        current?.end === params.end
      ) {
        return;
      }

      setLoading(true);
      try {
        const res = await callSidecar<DashboardStats>({
          method: "get_dashboard_stats",
          params: {
            workspace_id: selectedWorkspaceId === "all" ? undefined : selectedWorkspaceId,
            source_id: selectedSourceId === "all" ? undefined : selectedSourceId,
            start_time: isFirstLoad ? undefined : timeRange.start || undefined,
            end_time: isFirstLoad ? undefined : timeRange.end || undefined,
            active_workspace_ids: workspaces.map((w) => w.id),
          },
          silent: true,
        });
        setStats(res);
        syncTimeBounds(res, params);
      } catch (e) {
        console.error("Failed to fetch dashboard stats", e);
      } finally {
        setLoading(false);
      }
    },
    [selectedWorkspaceId, selectedSourceId, timeRange, workspaces, isFirstLoad, syncTimeBounds],
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Refresh dashboard stats immediately whenever logs are ingested or refreshed
  useEffect(() => {
    const handleRefresh = () => {
      fetchStats(true);
    };
    globalThis.addEventListener("loglens:refresh-logs", handleRefresh);
    return () => {
      globalThis.removeEventListener("loglens:refresh-logs", handleRefresh);
    };
  }, [fetchStats]);

  return {
    loading,
    stats,
    timeBounds,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    selectedSourceId,
    setSelectedSourceId,
    timeRange,
    setTimeRange,
    setIsFirstLoad,
    fetchStats,
  };
}
