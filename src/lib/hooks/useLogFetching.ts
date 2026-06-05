import { useCallback, useMemo, useRef, useState } from "react";
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

  // Keep track of the active source key to prevent fetching bounds, anomalies,
  // and facets redundantly on every search/filter/sort action.
  const lastSourceKeyRef = useRef<string | null>(null);

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
   * Primary data retrieval function. Fetches anomalies, logs, and facets concurrently.
   */
  const fetchLogs = useCallback(
    async (options?: { forceFull?: boolean }) => {
      if (!workspaceId || !activeSourceId || !queryParams) {
        if (!workspaceId) {
          return;
        }
        setLogs([], 0);
        setAvailableFacets({});
        return;
      }

      const currentSourceRef = activeSourceId;
      const sourceKey = `${workspaceId}_${activeSourceId}`;
      const isSourceChanged = lastSourceKeyRef.current !== sourceKey;
      const forceFull = options?.forceFull ?? false;
      const shouldFetchAll = isSourceChanged || forceFull;

      setIsFetching(true);

      try {
        if (!shouldFetchAll) {
          // OPTIMIZATION: Only fetch the logs when sorting, filtering, or searching.
          // Bounds, facets, and anomalies are independent of query/sort parameters.
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

          if (currentSourceRef === activeSourceId) {
            setLogs(logResult.logs ?? [], logResult.total ?? 0);
            setIsConnected(true);
          }
        } else {
          // OPTIMIZATION: Execute independent queries in parallel using Promise.all
          const boundsPromise = callSidecar<{ min_time: string; max_time: string }>({
            method: "get_time_boundaries",
            params: {
              workspace_id: workspaceId,
              source_ids: queryParams.isFusion ? undefined : [queryParams.activeSrc.id],
            },
            silent: true,
          }).catch((err) => {
            console.warn("[useLogFetching] Failed to get time boundaries:", err);
            return null;
          });

          const anomaliesPromise = showAnomalies
            ? callSidecar<{ anomalies: { cluster_id: string }[] }>({
                method: "get_anomalies",
                params: { workspace_id: workspaceId },
                silent: true,
              })
            : Promise.resolve({ anomalies: [] });

          const logsPromise = callSidecar<{ logs: LogEntry[]; total: number }>({
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

          const facetsPromise = callSidecar<Record<string, { value: string; count: number }[]>>({
            method: "get_metadata_facets",
            params: {
              workspace_id: workspaceId,
              source_ids: queryParams.isFusion ? undefined : [queryParams.activeSrc.id],
            },
            silent: true,
          });

          const [bounds, anomaliesRes, logResult, facetRes] = await Promise.all([
            boundsPromise,
            anomaliesPromise,
            logsPromise,
            facetsPromise,
          ]);

          if (currentSourceRef !== activeSourceId) {
            return;
          }

          // Process Bounds
          if (bounds?.min_time && bounds.max_time) {
            const minIso = bounds.min_time.replace(" ", "T");
            const maxIso = bounds.max_time.replace(" ", "T");
            const store = useInvestigationStore.getState();
            const boundsChanged =
              store.timeRangeBounds.start !== minIso || store.timeRangeBounds.end !== maxIso;
            store.setTimeRangeBounds({ start: minIso, end: maxIso });
            if (boundsChanged || (!store.timeRange.start && !store.timeRange.end)) {
              store.setTimeRange({ start: minIso, end: maxIso, label: "All Time" });
            }
          }

          // Process Anomalies
          if (anomaliesRes?.anomalies) {
            setAnomalousClusters(new Set(anomaliesRes.anomalies.map((a) => a.cluster_id)));
          } else {
            setAnomalousClusters(new Set());
          }

          // Process Logs
          setLogs(logResult.logs ?? [], logResult.total ?? 0);

          // Process Facets
          setAvailableFacets(facetRes);
          setIsConnected(true);
          lastSourceKeyRef.current = sourceKey;
        }
      } catch (e) {
        console.error("[useLogFetching] Data retrieval failed:", e);
        setIsConnected(false);
      } finally {
        setIsFetching(false);
      }
    },
    [
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
    ],
  );

  /**
   * Pagination support. Fetches the next batch of 1,000 logs and appends them.
   */
  const fetchMoreLogs = useCallback(async () => {
    if (!workspaceId || !activeSourceId || !queryParams || isFetching) {
      return;
    }

    const currentSourceRef = activeSourceId;
    const currentLogs = useInvestigationStore.getState().logs;
    const totalLogs = useInvestigationStore.getState().total;

    if (currentLogs.length >= totalLogs) {
      return; // All logs already loaded
    }

    setIsFetching(true);

    try {
      const logResult = await callSidecar<{ logs: LogEntry[]; total: number }>({
        method: queryParams.isFusion ? "get_fused_logs" : "get_logs",
        params: {
          workspace_id: workspaceId,
          ...(queryParams.fusionId ? { fusion_id: queryParams.fusionId } : {}),
          offset: currentLogs.length, // Load next batch
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

      if (currentSourceRef === activeSourceId) {
        setLogs([...currentLogs, ...(logResult.logs ?? [])], logResult.total ?? 0);
        setIsConnected(true);
      }
    } catch (e) {
      console.error("[useLogFetching] Fetching more logs failed:", e);
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
    isFetching,
    timeRange,
  ]);

  return {
    isFetching,
    isConnected,
    anomalousClusters,
    fetchLogs,
    fetchMoreLogs,
    queryParams,
  };
}
