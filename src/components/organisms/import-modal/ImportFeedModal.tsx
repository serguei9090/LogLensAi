import { SourceSelector } from "@/components/molecules/SourceSelector";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIngestionStore } from "@/store/ingestion";
import { useSettingsStore } from "@/store/settingsStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { isTauri, TABS } from "./constants";
import { LiveTab } from "./tabs/LiveTab";
import { LocalTab } from "./tabs/LocalTab";
import { ManualTab } from "./tabs/ManualTab";
import { SshTab } from "./tabs/SshTab";
import type { ImportFeedModalProps, TabId } from "./types";

export function ImportFeedModal({
  onImportLocal,
  onImportSSH,
  onIngestManual,
  onImportLive,
}: ImportFeedModalProps) {
  const {
    isImportOpen: open,
    setImportOpen: onOpenChange,
    isImportProcessing: isProcessing,
    importActiveTab: activeTab,
    setImportActiveTab: setActiveTab,
    importLocalPath: localPath,
    setImportLocalPath: setLocalPath,
    importLocalTail: localTail,
    setImportLocalTail: setLocalTail,
    importSshHost: sshHost,
    setImportSshHost: setSshHost,
    importSshPort: sshPort,
    setImportSshPort: setSshPort,
    importSshUser: sshUser,
    setImportSshUser: setSshUser,
    importSshPass: sshPass,
    setImportSshPass: setSshPass,
    importSshPath: sshPath,
    setImportSshPath: setSshPath,
    importSshTail: sshTail,
    setImportSshTail: setSshTail,
    importManualLogs: manualLogs,
    setImportManualLogs: setManualLogs,
    importLiveName: liveName,
    setImportLiveName: setLiveName,
    importLiveSyslog: liveSyslog,
    setImportLiveSyslog: setLiveSyslog,
    importLiveHttp: liveHttp,
    setImportLiveHttp: setLiveHttp,
    resetImportForm,
  } = useIngestionStore();

  const [isDragOver, setIsDragOver] = useState(false);

  const { activeWorkspaceId } = useWorkspaceStore();
  const { settings } = useSettingsStore();

  useEffect(() => {
    if (!open) {
      resetImportForm();
    }
  }, [open, resetImportForm]);

  useEffect(() => {
    if (!isTauri || !open) {
      return;
    }

    const promiseList: Promise<() => void>[] = [];

    async function initTauriDragDrop() {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        const overPromise = listen("tauri://drag-over", () => {
          setIsDragOver(true);
        });
        const leavePromise = listen("tauri://drag-leave", () => {
          setIsDragOver(false);
        });
        const dropPromise = listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
          setIsDragOver(false);
          const paths = event.payload?.paths;
          if (paths && paths.length > 0) {
            setLocalPath(paths[0]);
          }
        });

        promiseList.push(overPromise, leavePromise, dropPromise);
      } catch (err) {
        console.error("Failed to setup Tauri drag-drop listeners:", err);
      }
    }

    initTauriDragDrop();

    return () => {
      for (const p of promiseList) {
        p.then((unlisten) => unlisten());
      }
    };
  }, [open, setLocalPath]);

  if (!open) {
    return null;
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const path = (file as any).path || file.name;
      setLocalPath(path);
    }
  };

  const handleBrowse = async () => {
    if (isTauri) {
      try {
        const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
        const selected = await openDialog({
          multiple: false,
          directory: false,
          title: "Select File",
          filters: [
            { name: "Common Logs", extensions: ["log", "syslog", "txt", "json", "csv"] },
            { name: "All Files", extensions: ["*"] },
          ],
        });

        if (selected) {
          const path = Array.isArray(selected) ? selected[0] : selected;
          setLocalPath(path);
        }
      } catch (e) {
        console.warn("Native dialog error:", e);
      }
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".log,.syslog,.txt,.json,.csv";
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          setLocalPath(file.name);
        }
      };
      input.click();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        disabled={isProcessing}
        className={cn(
          "absolute inset-0 bg-bg-base/90 backdrop-blur-xl border-none outline-none appearance-none",
          isProcessing ? "cursor-not-allowed" : "cursor-default",
        )}
        onClick={() => {
          if (!isProcessing) {
            onOpenChange(false);
          }
        }}
        aria-label="Close modal"
      />

      <div className="relative z-10 w-full max-w-[560px] bg-bg-surface border border-border/80 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-white/[0.03]">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-lg font-bold text-text-primary tracking-tight">Ingest Source</h2>
            </div>
            <p className="text-xs text-text-muted opacity-60">
              Connect a data source for real-time analysis
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isProcessing}
            onClick={() => {
              if (!isProcessing) {
                onOpenChange(false);
              }
            }}
            className="text-text-muted/50 hover:text-text-primary"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="px-8 mt-6">
          <SourceSelector
            options={TABS}
            activeId={activeTab}
            onSelect={(id) => setActiveTab(id as TabId)}
          />
        </div>

        <div className="px-8 py-8 min-h-[340px]">
          {activeTab === "local" && (
            <LocalTab
              localPath={localPath}
              localTail={localTail}
              isDragOver={isDragOver}
              setLocalPath={setLocalPath}
              setLocalTail={setLocalTail}
              onImportLocal={onImportLocal}
              handleDragOver={handleDragOver}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              handleBrowse={handleBrowse}
            />
          )}

          {activeTab === "ssh" && (
            <SshTab
              sshHost={sshHost}
              setSshHost={setSshHost}
              sshPort={sshPort}
              setSshPort={setSshPort}
              sshUser={sshUser}
              setSshUser={setSshUser}
              sshPass={sshPass}
              setSshPass={setSshPass}
              sshPath={sshPath}
              setSshPath={setSshPath}
              sshTail={sshTail}
              setSshTail={setSshTail}
              onImportSSH={onImportSSH}
            />
          )}

          {activeTab === "manual" && (
            <ManualTab
              manualLogs={manualLogs}
              setManualLogs={setManualLogs}
              onIngestManual={onIngestManual}
            />
          )}

          {activeTab === "live" && (
            <LiveTab
              liveName={liveName}
              setLiveName={setLiveName}
              liveSyslog={liveSyslog}
              setLiveSyslog={setLiveSyslog}
              liveHttp={liveHttp}
              setLiveHttp={setLiveHttp}
              onImportLive={onImportLive}
              settings={settings}
              activeWorkspaceId={activeWorkspaceId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
