import { ExplorerView } from "@/components/organisms/ExplorerView";
import { VirtualLogTable } from "@/components/organisms/VirtualLogTable";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import type { Workspace } from "@/store/workspaceStore";
import type { LogEntry } from "@/types/log";
import { toast } from "sonner";

interface InvestigationTableAreaProps {
  readonly activeSourceId: string | null;
  readonly activeWorkspaceId: string | null;
  readonly activeWorkspace: Workspace | null | undefined;
  readonly activeFolderId: string | null;
  readonly logs: LogEntry[];
  readonly highlights: any[];
  readonly sortBy: string;
  readonly sortOrder: "asc" | "desc";
  readonly onSort: (field: string) => void;
  readonly anomalousClusters: Set<string>;
  readonly activeJobForSource: any;
  readonly isSourceLoading: boolean;
  readonly fetchMoreLogs: () => void;
  readonly total: number;
  readonly isFetching: boolean;
  readonly updateLog: (id: number, updates: Partial<LogEntry>) => void;
  readonly onAnalyzeCluster: (clusterId: string) => void;
  readonly onOpenParser: (sourceId: string) => void;
  readonly onOpenImport: () => void;
  readonly setActiveFolder: (workspaceId: string, folderId: string | null) => void;
  readonly setActiveSource: (workspaceId: string, sourceId: string | null) => void;
  readonly createFolder: (workspaceId: string, name: string) => void;
  readonly updateFolder: (id: string, name: string) => Promise<void>;
  readonly deleteFolder: (id: string) => Promise<void>;
  readonly renameSource: (workspaceId: string, id: string, name: string) => void;
  readonly handleRemoveSource: (id: string) => void;
}

export function InvestigationTableArea({
  activeSourceId,
  activeWorkspaceId,
  activeWorkspace,
  activeFolderId,
  logs,
  highlights,
  sortBy,
  sortOrder,
  onSort,
  anomalousClusters,
  activeJobForSource,
  isSourceLoading,
  fetchMoreLogs,
  total,
  isFetching,
  updateLog,
  onAnalyzeCluster,
  onOpenParser,
  onOpenImport,
  setActiveFolder,
  setActiveSource,
  createFolder,
  updateFolder,
  deleteFolder,
  renameSource,
  handleRemoveSource,
}: InvestigationTableAreaProps) {
  if (activeSourceId) {
    return (
      <VirtualLogTable
        logs={logs}
        highlights={highlights}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        anomalousClusters={anomalousClusters}
        activeJob={activeJobForSource}
        isTransitioning={isSourceLoading}
        fetchMoreLogs={fetchMoreLogs}
        total={total}
        isFetching={isFetching}
        onAddComment={(id, comment) => {
          const has_comment = comment.trim().length > 0;
          const originalLog = logs.find((l) => l.id === id);
          updateLog(id, { comment, has_comment });
          callSidecar({ method: "update_log_comment", params: { log_id: id, comment } })
            .then(() => toast.success("Annotation saved"))
            .catch(() => {
              if (originalLog) {
                updateLog(id, {
                  comment: originalLog.comment,
                  has_comment: originalLog.has_comment,
                });
              }
              toast.error("Failed to save annotation");
            });
        }}
        onAnalyzeCluster={onAnalyzeCluster}
        onOpenParser={onOpenParser}
        onImport={onOpenImport}
      />
    );
  }

  return (
    <ExplorerView
      folderId={activeFolderId}
      hierarchy={activeWorkspace?.hierarchy}
      onSelectFolder={(id) => setActiveFolder(activeWorkspaceId ?? "", id)}
      onSelectSource={(id) => setActiveSource(activeWorkspaceId ?? "", id)}
      onCreateFolder={(name) => createFolder(activeWorkspaceId ?? "", name)}
      onImportOpen={onOpenImport}
      workspaceName={activeWorkspace?.name}
      onRenameFolder={async (id, name) => {
        await updateFolder(id, name);
      }}
      onDeleteFolder={async (id) => {
        await deleteFolder(id);
      }}
      onRenameSource={(id, name) => {
        if (activeWorkspaceId) {
          renameSource(activeWorkspaceId, id, name);
        }
      }}
      onDeleteSource={(id) => {
        handleRemoveSource(id);
      }}
    />
  );
}
