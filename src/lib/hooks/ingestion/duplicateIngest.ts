import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { type IngestionJob, traceIngestion, useIngestionStore } from "@/store/ingestion";
import { useInvestigationStore } from "@/store/investigationStore";
import { type LogSource, useWorkspaceStore } from "@/store/workspaceStore";
import { toast } from "sonner";

export async function duplicateLogSource(workspaceId: string, source: LogSource) {
  try {
    const activeSources =
      useWorkspaceStore.getState().workspaces.find((w) => w.id === workspaceId)?.sources ?? [];

    const baseDuplicateName = `${source.name} (Copy)`;
    let finalName = baseDuplicateName;
    let counter = 2;
    while (activeSources.some((s) => s.name === finalName)) {
      finalName = `${source.name} (Copy ${counter})`;
      counter++;
    }

    traceIngestion(
      `[Hook] duplicateSource: Creating duplicate source "${finalName}" for path=${source.path}`,
    );

    const newSource = await useWorkspaceStore.getState().createSource(workspaceId, {
      name: finalName,
      type: source.type,
      path: source.path,
    });

    const currentInvestigation = useInvestigationStore.getState();
    const existingSnapshot = currentInvestigation.sourceStates[source.id] ?? {
      searchQuery: currentInvestigation.searchQuery,
      filters: currentInvestigation.filters,
      highlights: currentInvestigation.highlights,
      logs: currentInvestigation.logs,
      total: currentInvestigation.total,
      offset: currentInvestigation.offset,
      sortBy: currentInvestigation.sortBy,
      sortOrder: currentInvestigation.sortOrder,
      timeRange: currentInvestigation.timeRange,
      timeRangeBounds: currentInvestigation.timeRangeBounds,
      selectedLogIds: [],
      availableFacets: currentInvestigation.availableFacets,
    };

    useInvestigationStore.setState((state) => ({
      sourceStates: {
        ...state.sourceStates,
        [newSource.id]: {
          ...existingSnapshot,
          selectedLogIds: [],
        },
      },
    }));

    useWorkspaceStore.getState().setActiveSource(workspaceId, newSource.id);

    if (source.type === "local" && source.path) {
      const { addTransitioningSource, removeTransitioningSource } = useIngestionStore.getState();
      addTransitioningSource(newSource.id);
      useIngestionStore.getState().startIngestion(newSource.id);

      const result = await callSidecar<{
        status: string;
        job_id: number;
        total_lines: number;
        queue_position: number;
      }>({
        method: "ingest_local_file",
        params: {
          filepath: source.path,
          workspace_id: workspaceId,
          source_id: newSource.id,
        },
      });

      removeTransitioningSource(newSource.id);
      useIngestionStore.getState().stopIngestion(newSource.id);

      if (result.status === "completed") {
        const mockCompletedJob: IngestionJob = {
          id: Date.now(),
          workspace_id: workspaceId,
          source_id: newSource.id,
          status: "completed",
          total_lines: result.total_lines ?? 0,
          processed_lines: result.total_lines ?? 0,
          queue_position: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        useIngestionStore.getState().addOrUpdateJob(mockCompletedJob);
        useIngestionStore.getState().markJobHandled(mockCompletedJob.id);
      }
    }

    await useWorkspaceStore.getState().fetchHierarchy(workspaceId);
    globalThis.dispatchEvent(new CustomEvent("loglens:refresh-logs"));
    toast.success(`Duplicated view as "${finalName}" with independent filters.`);
  } catch (err: unknown) {
    console.error("[Hook] duplicateSource failed:", err);
    toast.error(err instanceof Error ? err.message : "Failed to duplicate source view.");
  }
}
