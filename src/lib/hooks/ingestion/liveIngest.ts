import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useIngestionStore } from "@/store/ingestion";
import { useSettingsStore } from "@/store/settingsStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { toast } from "sonner";

export async function importLiveStream(
  workspaceId: string,
  name: string,
  types: { syslog: boolean; http: boolean },
  folderId?: string | null,
) {
  const { setImportProcessing, setImportOpen, addLiveSource, startPolling } =
    useIngestionStore.getState();
  const { createSource, setActiveSource } = useWorkspaceStore.getState();
  const { settings } = useSettingsStore.getState();

  setImportProcessing(true);

  try {
    const promises = [];
    if (types.syslog) {
      promises.push(
        callSidecar({
          method: "create_log_stream",
          params: {
            workspace_id: workspaceId,
            type: "syslog",
            name: name,
            port: settings.ingestion_syslog_port,
          },
        }),
      );
    }
    if (types.http) {
      promises.push(
        callSidecar({
          method: "create_log_stream",
          params: {
            workspace_id: workspaceId,
            type: "http",
            name: name,
            port: settings.ingestion_http_port,
          },
        }),
      );
    }

    await Promise.all(promises);

    const newSource = await createSource(workspaceId, { name, type: "live", path: name }, folderId);

    setActiveSource(workspaceId, newSource.id);

    const streamCount = [types.syslog, types.http].filter(Boolean).length;
    for (let i = 0; i < streamCount; i++) {
      addLiveSource();
    }
    startPolling(workspaceId);

    const listeningOn = [
      types.syslog && `UDP:${settings.ingestion_syslog_port}`,
      types.http && `HTTP:${settings.ingestion_http_port}`,
    ]
      .filter(Boolean)
      .join(" & ");

    toast.success(`Live collection "${name}" active`, {
      id: "live-ingest",
      description: listeningOn ? `Listening on ${listeningOn}` : undefined,
    });

    setTimeout(() => {
      setImportOpen(false);
      setImportProcessing(false);
    }, 300);
  } catch (e: unknown) {
    setImportProcessing(false);
    toast.error(e instanceof Error ? e.message : "Failed to start live collection.", {
      id: "live-ingest",
    });
  }
}
