import type { TimeRange } from "@/components/molecules/time-picker";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import type { LogSource } from "@/store/workspaceStore";
import { toast } from "sonner";

interface UseInvestigationExportOptions {
  readonly activeWorkspaceId: string | null;
  readonly activeSourceId: string | null;
  readonly sources: LogSource[];
  readonly searchQuery: string;
  readonly filters: any[];
  readonly sortBy: string;
  readonly sortOrder: "asc" | "desc";
  readonly timeRange: TimeRange;
}

export function useInvestigationExport({
  activeWorkspaceId,
  activeSourceId,
  sources,
  searchQuery,
  filters,
  sortBy,
  sortOrder,
  timeRange,
}: UseInvestigationExportOptions) {
  const handleExport = async () => {
    if (!activeWorkspaceId) {
      return;
    }

    try {
      const activeSource = sources.find((s) => s.id === activeSourceId);
      const isFusion = activeSource?.type === "fusion";
      const fusionId = isFusion ? activeSource.path : null;
      const dateStr = new Date().toISOString().split("T")[0];
      const isTauri =
        typeof globalThis.window !== "undefined" && "__TAURI_INTERNALS__" in globalThis.window;

      if (isTauri) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const path = await save({
          title: "Export Logs",
          filters: [
            { name: "CSV", extensions: ["csv"] },
            { name: "JSON", extensions: ["json"] },
          ],
          defaultPath: `loglens_export_${dateStr}.csv`,
        });

        if (!path) {
          return;
        }

        const format = path.endsWith(".json") ? "json" : "csv";
        toast.loading(`Exporting logs to ${format.toUpperCase()}...`, { id: "export" });

        await callSidecar({
          method: "export_logs",
          params: {
            workspace_id: activeWorkspaceId,
            filepath: path,
            format,
            query: searchQuery || undefined,
            filters: filters.length > 0 ? filters : undefined,
            fusion_id: fusionId,
            start_time: timeRange.start || undefined,
            end_time: timeRange.end || undefined,
          },
        });

        toast.success("Export complete", { id: "export", description: `Saved to ${path}` });
      } else {
        // Web Mode Fallback: Fetch logs and trigger browser download
        toast.loading("Generating export file...", { id: "export" });

        const logResult = await callSidecar<{ logs: any[]; total: number }>({
          method: isFusion ? "get_fused_logs" : "get_logs",
          params: {
            workspace_id: activeWorkspaceId,
            ...(fusionId ? { fusion_id: fusionId } : {}),
            offset: 0,
            limit: 100000,
            query: searchQuery || undefined,
            filters: filters.length > 0 ? filters : undefined,
            sort_by: sortBy,
            sort_order: sortOrder,
            start_time: timeRange.start || undefined,
            end_time: timeRange.end || undefined,
          },
        });

        const exportLogs = logResult?.logs ?? [];
        if (exportLogs.length === 0) {
          toast.info("No logs to export", { id: "export" });
          return;
        }

        // Generate CSV content
        const headers = ["id", "timestamp", "level", "message", "cluster_id", "facets"];
        const csvRows = [headers.join(",")];
        for (const row of exportLogs) {
          const values = [
            row.id ?? "",
            `"${String(row.timestamp ?? "").replace(/"/g, '""')}"`,
            `"${String(row.level ?? "").replace(/"/g, '""')}"`,
            `"${String(row.message ?? "").replace(/"/g, '""')}"`,
            row.cluster_id ?? "",
            `"${typeof row.facets === "object" ? JSON.stringify(row.facets).replace(/"/g, '""') : ""}"`,
          ];
          csvRows.push(values.join(","));
        }

        const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `loglens_export_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success("Export complete", {
          id: "export",
          description: `Downloaded ${exportLogs.length} logs as CSV`,
        });
      }
    } catch (e: any) {
      console.error("Export failed", e);
      toast.error(e?.message || "Export failed", { id: "export" });
    }
  };

  return { handleExport };
}
