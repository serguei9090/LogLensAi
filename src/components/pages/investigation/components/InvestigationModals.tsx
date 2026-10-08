import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import type { LogSource } from "@/store/workspaceStore";
import { Suspense, lazy } from "react";
import { toast } from "sonner";

const CustomParserModal = lazy(() =>
  import("@/components/organisms/custom-parser").then((m) => ({
    default: m.CustomParserModal,
  })),
);
const ImportFeedModal = lazy(() =>
  import("@/components/organisms/ImportFeedModal").then((m) => ({ default: m.ImportFeedModal })),
);
const OrchestratorHub = lazy(() =>
  import("@/components/organisms/OrchestratorHub").then((m) => ({ default: m.OrchestratorHub })),
);
const WorkspaceEngineSettings = lazy(() =>
  import("@/components/organisms/WorkspaceEngineSettings").then((m) => ({
    default: m.WorkspaceEngineSettings,
  })),
);

interface InvestigationModalsProps {
  readonly activeWorkspaceId: string | null;
  readonly activeFolderId: string | null;
  readonly activeParserSource: string | null;
  readonly initialParserConfig: string | null;
  readonly onCloseParser: () => void;
  readonly onParserSaved: () => void;
  readonly isImportOpen: boolean;
  readonly onImportLocal: (path: string, tail: boolean, folderId: string | null) => void;
  readonly onImportSSH: (
    host: string,
    port: number,
    user: string,
    pass: string,
    path: string,
    tail: boolean,
    folderId: string | null,
  ) => void;
  readonly onIngestManual: (logs: string, folderId: string | null) => void;
  readonly onImportLive: (
    name: string,
    types: { syslog: boolean; http: boolean },
    folderId: string | null,
  ) => void;
  readonly isOrchestratorOpen: boolean;
  readonly onCloseOrchestrator: () => void;
  readonly nonFusionSources: LogSource[];
  readonly editingFusionId: string | null;
  readonly editingFusionName: string | null;
  readonly onEngineSettingsOpen: () => void;
  readonly onFusionSaved: (fusionId: string, fusionName: string) => Promise<void>;
  readonly isEngineSettingsOpen: boolean;
  readonly onCloseEngineSettings: () => void;
}

export function InvestigationModals({
  activeWorkspaceId,
  activeFolderId,
  activeParserSource,
  initialParserConfig,
  onCloseParser,
  onParserSaved,
  isImportOpen,
  onImportLocal,
  onImportSSH,
  onIngestManual,
  onImportLive,
  isOrchestratorOpen,
  onCloseOrchestrator,
  nonFusionSources,
  editingFusionId,
  editingFusionName,
  onEngineSettingsOpen,
  onFusionSaved,
  isEngineSettingsOpen,
  onCloseEngineSettings,
}: InvestigationModalsProps) {
  return (
    <>
      {activeParserSource && (
        <Suspense fallback={null}>
          <CustomParserModal
            workspaceId={activeWorkspaceId ?? ""}
            sourceId={activeParserSource}
            isOpen={!!activeParserSource}
            onClose={onCloseParser}
            initialConfig={initialParserConfig}
            onSaved={async (config) => {
              if (!activeWorkspaceId || !activeParserSource) {
                return;
              }
              try {
                await callSidecar({
                  method: "update_source_parser",
                  params: {
                    workspace_id: activeWorkspaceId,
                    source_id: activeParserSource,
                    parser_config: config,
                  },
                });
                toast.success("Log parser re-calibrated.");
                onParserSaved();
              } catch (e) {
                console.error("Failed to update parser", e);
                toast.error("Failed to update log parser.");
              }
            }}
          />
        </Suspense>
      )}

      {isImportOpen && (
        <Suspense fallback={null}>
          <ImportFeedModal
            onImportLocal={(path, tail) => onImportLocal(path, tail, activeFolderId)}
            onImportSSH={(host, port, user, pass, path, tail) =>
              onImportSSH(host, port, user, pass, path, tail, activeFolderId)
            }
            onIngestManual={(logs) => onIngestManual(logs, activeFolderId)}
            onImportLive={(name, types) => onImportLive(name, types, activeFolderId)}
          />
        </Suspense>
      )}

      {isOrchestratorOpen && (
        <Suspense fallback={null}>
          <OrchestratorHub
            isOpen={isOrchestratorOpen}
            onClose={onCloseOrchestrator}
            workspaceId={activeWorkspaceId ?? ""}
            availableSources={nonFusionSources}
            editingFusionId={editingFusionId}
            editingFusionName={editingFusionName}
            onEngineSettingsOpen={onEngineSettingsOpen}
            onFusionSaved={onFusionSaved}
          />
        </Suspense>
      )}

      {isEngineSettingsOpen && (
        <Suspense fallback={null}>
          <WorkspaceEngineSettings
            isOpen={isEngineSettingsOpen}
            onClose={onCloseEngineSettings}
            workspaceId={activeWorkspaceId ?? ""}
          />
        </Suspense>
      )}
    </>
  );
}
