import { useCallback, useMemo, useState } from "react";
import { useInvestigationStore } from "@/store/investigationStore";
import { type LogSource, selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import type { LogEntry } from "@/types/log";
import { callSidecar } from "./useSidecarBridge";

/**
 * useLogFetching handles the retrieval of logs, metadata facets, and anomalies
 * from the sidecar. It encapsulates the complex query parameter logic and
 * manages loading/connection states.
 */
export function useLogFetching(workspaceId: string | null, activeSourceId: string | null) {
  const {
    searchQuery,
    filters,
    sortBy,
    sortOrder,
    timeRange,
    showAnomalies,
    setLogs,
    setAvailableFacets,
  } = useInvestigationStore();

  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const sources: LogSource[] = activeWorkspace?.sources ?? [];

  const [isFetching, setIsFetching] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [anomalousClusters, setAnomalousClusters] = useState<Set<string>>(new Set());

  /**
   * Memoized query parameters derived from the active source and active filters.
   */
  const queryParams = useMemo(() => {
    const activeSrc = sources.find((s) => s.id === activeSourceId);
    if (!activeSrc) {
      return null;
    }

    const isFusion = activeSrc.type === "fusion";
    const sourceFilter = isFusion
      ? []
      : [{ field: "source_id", operator: "equals", value: activeSrc.id }];

    const combinedFilters =
      filters.length > 0 || sourceFilter.length > 0 ? [...sourceFilter, ...filters] : undefined;
    const fusionId = isFusion ? activeSrc.path : undefined;

    return {
      isFusion,
      fusionId,
      combinedFilters,
      activeSrc,
    };
  }, [sources, activeSourceId, filters]);

  /**
   * Primary data retrieval function. Fetches anomalies, logs, and facets in sequence.
   */
  const fetchLogs = useCallback(async () => {
    if (!workspaceId || !activeSourceId || !queryParams) {
      if (!workspaceId) {
        return;
      }
      setLogs([], 0);
      setAvailableFacets({});
      return;
    }

    const currentSourceRef = activeSourceId;
    setIsFetching(true);

    try {
      // 0. Fetch Time Boundaries & Auto-Initialize Time Range
      try {
        const bounds = await callSidecar<{ min_time: string; max_time: string }>({
          method: "get_time_boundaries",
          params: {
            workspace_id: workspaceId,
            source_ids: queryParams.isFusion ? undefined : [queryParams.activeSrc.id],
          },
          silent: true,
        });
        if (bounds && bounds.min_time && bounds.max_time && currentSourceRef === activeSourceId) {
          const minIso = bounds.min_time.replace(" ", "T");
          const maxIso = bounds.max_time.replace(" ", "T");
          const store = useInvestigationStore.getState();
          store.setTimeRangeBounds({ start: minIso, end: maxIso });
          if (!store.timeRange.start && !store.timeRange.end) {
            store.setTimeRange({ start: minIso, end: maxIso, label: "All Time" });
            return;
          }
        }
      } catch (err) {
        console.warn("[useLogFetching] Failed to get time boundaries:", err);
      }

      // 1. Fetch Anomalies
      if (showAnomalies) {
        const res = await callSidecar<{ anomalies: { cluster_id: string }[] }>({
          method: "get_anomalies",
          params: { workspace_id: workspaceId },
          silent: true,
        });
        if (currentSourceRef === activeSourceId) {
          setAnomalousClusters(new Set(res.anomalies.map((a) => a.cluster_id)));
        }
      } else {
        setAnomalousClusters(new Set());
      }

      // 2. Fetch Logs
      const logResult = await callSidecar<{ logs: LogEntry[]; total: number }>({
        method: queryParams.isFusion ? "get_fused_logs" : "get_logs",
        params: {
          workspace_id: workspaceId,
          ...(queryParams.fusionId ? { fusion_id: queryParams.fusionId } : {}),
          offset: 0,
          limit: 1000,
          query: searchQuery || undefined,
          filters: queryParams.combinedFilters,
          sort_by: sortBy,
          sort_order: sortOrder,
          start_time: timeRange.start || undefined,
          end_time: timeRange.end || undefined,
        },
        silent: true,
      });

      if (currentSourceRef !== activeSourceId) {
        return;
      }
      setLogs(logResult.logs ?? [], logResult.total ?? 0);

      // 3. Fetch Facets
      const facetRes = await callSidecar<Record<string, { value: string; count: number }[]>>({
        method: "get_metadata_facets",
        params: {
          workspace_id: workspaceId,
          source_ids: queryParams.isFusion ? undefined : [queryParams.activeSrc.id],
        },
        silent: true,
      });

      if (currentSourceRef === activeSourceId) {
        setAvailableFacets(facetRes);
        setIsConnected(true);
      }
    } catch (e) {
      console.error("[useLogFetching] Data retrieval failed:", e);
      setIsConnected(false);
    } finally {
      setIsFetching(false);
    }
  }, [
    workspaceId,
    activeSourceId,
    queryParams,
    searchQuery,
    sortBy,
    sortOrder,
    setLogs,
    setAvailableFacets,
    showAnomalies,
    timeRange,
  ]);

  return {
    isFetching,
    isConnected,
    anomalousClusters,
    fetchLogs,
    queryParams,
  };
}
