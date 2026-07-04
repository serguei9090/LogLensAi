import {
  Activity,
  Code,
  FileText,
  FolderOpen,
  Info,
  Server,
  Terminal,
  Upload,
  Wifi,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { TailSwitch } from "@/components/atoms/TailSwitch";
import { SourceSelector } from "@/components/molecules/SourceSelector";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIngestionStore } from "@/store/ingestionStore";
import { type AppSettings, useSettingsStore } from "@/store/settingsStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

const isTauri = globalThis.window !== undefined && "__TAURI_INTERNALS__" in globalThis.window;

interface ImportFeedModalProps {
  readonly onImportLocal: (path: string, tail: boolean) => void;
  readonly onImportSSH: (
    host: string,
    port: number,
    user: string,
    pass: string,
    path: string,
    tail: boolean,
  ) => void;
  readonly onIngestManual: (logs: string) => void;
  readonly onImportLive: (name: string, types: { syslog: boolean; http: boolean }) => void;
}

type TabId = "local" | "ssh" | "manual" | "live";

const TABS: { id: TabId; icon: typeof FolderOpen; label: string }[] = [
  { id: "local", icon: FolderOpen, label: "Files" },
  { id: "ssh", icon: Server, label: "SSH" },
  { id: "manual", icon: Code, label: "Manual" },
  { id: "live", icon: Activity, label: "Live" },
];

const inputCls =
  "w-full h-10 px-4 rounded-xl text-sm bg-bg-surface border border-border text-text-primary placeholder:text-text-muted/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-sans";

const labelCls = "text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2 ml-1 block";

// ─── Sub-Components ─────────────────────────────────────────────────────────

interface LocalTabProps {
  readonly localPath: string;
  readonly localTail: boolean;
  readonly isDragOver: boolean;
  readonly setLocalPath: (val: string) => void;
  readonly setLocalTail: (val: boolean) => void;
  readonly onImportLocal: (path: string, tail: boolean) => void;
  readonly handleDragOver: (e: React.DragEvent) => void;
  readonly handleDragLeave: () => void;
  readonly handleDrop: (e: React.DragEvent) => void;
  readonly handleBrowse: () => void;
}

function LocalTab({
  localPath,
  localTail,
  isDragOver,
  setLocalPath,
  setLocalTail,
  onImportLocal,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleBrowse,
}: LocalTabProps) {
  const isProcessing = useIngestionStore((state) => state.isImportProcessing);
  return (
    <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
      <div className="space-y-4">
        <span className={labelCls}>Source File</span>
        {localPath ? (
          <div className="flex items-center justify-between border border-border/80 bg-white/[0.02] rounded-[1.5rem] p-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-3 bg-primary/10 rounded-xl">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-text-primary truncate">
                  {localPath.split(/[/\\]/).pop() || localPath}
                </span>
                <span className="text-[10px] text-text-muted/60 truncate font-mono">
                  {localPath}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isProcessing}
              onClick={() => setLocalPath("")}
              className="text-text-muted hover:text-error transition-colors shrink-0"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isProcessing}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowse}
            className={cn(
              "w-full border border-dashed rounded-[1.5rem] p-10 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer select-none outline-none focus-visible:border-primary focus-visible:bg-primary/5",
              isDragOver
                ? "border-primary bg-primary/10 scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                : "border-border/60 hover:border-primary hover:bg-white/[0.01]",
              isProcessing && "opacity-50 cursor-not-allowed pointer-events-none",
            )}
          >
            {isDragOver ? (
              <FileText className="h-8 w-8 text-primary animate-bounce" />
            ) : (
              <Upload className="h-8 w-8 text-text-muted/40 animate-pulse" />
            )}
            <div className="text-center">
              <p className="text-xs font-semibold text-text-primary">
                {isDragOver ? "Drop your file here!" : "Drag & Drop log file here"}
              </p>
              <p className="text-[10px] text-text-muted/60 mt-1">
                {isDragOver ? "Release to select" : "or click to browse local files"}
              </p>
            </div>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between pt-6 border-t border-border/40">
        <TailSwitch
          checked={localTail}
          onCheckedChange={setLocalTail}
          label="Tail"
          disabled={isProcessing}
        />
        <Button
          disabled={!localPath.trim() || isProcessing}
          size="lg"
          onClick={() => {
            onImportLocal(localPath.trim(), localTail);
          }}
          className="font-black"
        >
          {isProcessing ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Upload className="size-5" />
          )}
          {isProcessing ? "Processing..." : "Initialize"}
        </Button>
      </div>
    </div>
  );
}

interface SshTabProps {
  readonly sshHost: string;
  readonly setSshHost: (val: string) => void;
  readonly sshPort: string;
  readonly setSshPort: (val: string) => void;
  readonly sshUser: string;
  readonly setSshUser: (val: string) => void;
  readonly sshPass: string;
  readonly setSshPass: (val: string) => void;
  readonly sshPath: string;
  readonly setSshPath: (val: string) => void;
  readonly sshTail: boolean;
  readonly setSshTail: (val: boolean) => void;
  readonly onImportSSH: (
    host: string,
    port: number,
    user: string,
    pass: string,
    path: string,
    tail: boolean,
  ) => void;
}

function SshTab({
  sshHost,
  setSshHost,
  sshPort,
  setSshPort,
  sshUser,
  setSshUser,
  sshPass,
  setSshPass,
  sshPath,
  setSshPath,
  sshTail,
  setSshTail,
  onImportSSH,
}: SshTabProps) {
  const isProcessing = useIngestionStore((state) => state.isImportProcessing);
  return (
    <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3 space-y-2">
          <label htmlFor="ssh-host" className={labelCls}>
            Secure Host
          </label>
          <input
            id="ssh-host"
            disabled={isProcessing}
            placeholder="server.prod.local"
            className={cn(inputCls, "h-11")}
            value={sshHost}
            onChange={(e) => setSshHost(e.target.value)}
          />
        </div>
        <div className="col-span-1 space-y-2">
          <label htmlFor="ssh-port" className={labelCls}>
            Port
          </label>
          <input
            id="ssh-port"
            type="number"
            disabled={isProcessing}
            className={cn(inputCls, "h-11")}
            value={sshPort}
            onChange={(e) => setSshPort(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="ssh-user" className={labelCls}>
            Login User
          </label>
          <input
            id="ssh-user"
            disabled={isProcessing}
            className={cn(inputCls, "h-11")}
            value={sshUser}
            onChange={(e) => setSshUser(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="ssh-pass" className={labelCls}>
            Secret / Key
          </label>
          <input
            id="ssh-pass"
            type="password"
            disabled={isProcessing}
            placeholder="••••••••"
            className={cn(inputCls, "h-11")}
            value={sshPass}
            onChange={(e) => setSshPass(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="ssh-path" className={labelCls}>
          Absolute Log Path
        </label>
        <input
          id="ssh-path"
          disabled={isProcessing}
          placeholder="/var/log/syslog"
          className={cn(inputCls, "font-mono text-xs h-11")}
          value={sshPath}
          onChange={(e) => setSshPath(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between pt-6 border-t border-border/40">
        <TailSwitch
          checked={sshTail}
          onCheckedChange={setSshTail}
          label="Stream remotely"
          disabled={isProcessing}
        />
        <Button
          disabled={!sshHost || !sshUser || !sshPath || isProcessing}
          size="lg"
          onClick={() => {
            onImportSSH(sshHost, Number(sshPort), sshUser, sshPass, sshPath, sshTail);
          }}
          className="font-black"
        >
          {isProcessing ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Terminal className="size-5" />
          )}
          {isProcessing ? "Connecting..." : "Connect"}
        </Button>
      </div>
    </div>
  );
}

interface ManualTabProps {
  readonly manualLogs: string;
  readonly setManualLogs: (val: string) => void;
  readonly onIngestManual: (logs: string) => void;
}

function ManualTab({ manualLogs, setManualLogs, onIngestManual }: ManualTabProps) {
  const isProcessing = useIngestionStore((state) => state.isImportProcessing);
  return (
    <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
      <div className="space-y-3">
        <label htmlFor="manual-logs" className={labelCls}>
          Direct Paste{" "}
          <span className="text-text-muted/40 font-normal ml-1">— newline separated</span>
        </label>
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-primary/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
          <textarea
            id="manual-logs"
            disabled={isProcessing}
            placeholder={
              "[2024-03-27 10:00:00] INFO Engine started...\n[2024-03-27 10:00:01] ERROR Connection refused"
            }
            rows={8}
            className="relative w-full px-5 py-4 rounded-2xl text-[11px] font-mono bg-bg-surface border border-border text-text-primary placeholder:text-text-muted/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 resize-none transition-all"
            value={manualLogs}
            onChange={(e) => setManualLogs(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button
          disabled={!manualLogs.trim() || isProcessing}
          size="lg"
          onClick={() => {
            onIngestManual(manualLogs.trim());
          }}
          className="font-black"
        >
          {isProcessing ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Upload className="size-5" />
          )}
          {isProcessing ? "Processing..." : "Process Buffer"}
        </Button>
      </div>
    </div>
  );
}

interface LiveTabProps {
  readonly liveName: string;
  readonly setLiveName: (val: string) => void;
  readonly liveSyslog: boolean;
  readonly setLiveSyslog: (val: boolean) => void;
  readonly liveHttp: boolean;
  readonly setLiveHttp: (val: boolean) => void;
  readonly onImportLive: (name: string, types: { syslog: boolean; http: boolean }) => void;
  readonly settings: AppSettings;
  readonly activeWorkspaceId: string | null;
}

function LiveTab({
  liveName,
  setLiveName,
  liveSyslog,
  setLiveSyslog,
  liveHttp,
  setLiveHttp,
  onImportLive,
  settings,
  activeWorkspaceId,
}: LiveTabProps) {
  const isProcessing = useIngestionStore((state) => state.isImportProcessing);
  return (
    <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="live-name" className={labelCls}>
            Collection Label (Tab Name)
          </label>
          <input
            id="live-name"
            disabled={isProcessing}
            placeholder="e.g. Production Cluster"
            className={cn(inputCls, "h-12")}
            value={liveName}
            onChange={(e) => setLiveName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="ghost"
            disabled={isProcessing}
            onClick={() => setLiveSyslog(!liveSyslog)}
            className={cn(
              "p-5 rounded-2xl border transition-all text-left flex flex-col gap-2 h-auto",
              liveSyslog
                ? "bg-primary/5 border-primary shadow-sm"
                : "bg-bg-surface border-border opacity-60 hover:opacity-100",
            )}
          >
            <div className="flex items-center justify-between w-full">
              <Wifi className={cn("h-5 w-5", liveSyslog ? "text-primary" : "text-text-muted")} />
              <div
                className={cn(
                  "w-2 h-2 rounded-full transform transition-transform",
                  liveSyslog ? "bg-primary scale-100 animate-pulse" : "bg-text-muted scale-75",
                )}
              />
            </div>
            <span
              className={cn("text-xs font-bold", liveSyslog ? "text-primary" : "text-text-muted")}
            >
              Syslog (UDP)
            </span>
            <span className="text-[10px] text-text-muted/60">Passive listening on port 514</span>
          </Button>

          <Button
            variant="ghost"
            disabled={isProcessing}
            onClick={() => setLiveHttp(!liveHttp)}
            className={cn(
              "p-5 rounded-2xl border transition-all text-left flex flex-col gap-2 h-auto",
              liveHttp
                ? "bg-primary/5 border-primary shadow-sm"
                : "bg-bg-surface border-border opacity-60 hover:opacity-100",
            )}
          >
            <div className="flex items-center justify-between w-full">
              <Terminal className={cn("h-5 w-5", liveHttp ? "text-primary" : "text-text-muted")} />
              <div
                className={cn(
                  "w-2 h-2 rounded-full transform transition-transform",
                  liveHttp ? "bg-primary scale-100 animate-pulse" : "bg-text-muted scale-75",
                )}
              />
            </div>
            <span
              className={cn("text-xs font-bold", liveHttp ? "text-primary" : "text-text-muted")}
            >
              HTTP API
            </span>
            <span className="text-[10px] text-text-muted/60">POST endpoint on port 5002</span>
          </Button>
        </div>

        <div className="flex items-start gap-3 border border-orange-500/20 bg-orange-500/5 rounded-2xl p-4">
          <Info className="h-5 w-5 shrink-0 mt-0.5 text-orange-500" />
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-tight">
              Configuration Note
            </p>
            <p className="text-[11px] text-text-muted leading-relaxed opacity-80">
              Ports are managed globally in **Settings**. All traffic matching the selected
              protocols will be routed to this workspace using the label above.
            </p>
          </div>
        </div>

        {(liveHttp || liveSyslog) && (
          <div className="bg-bg-dark/50 border border-border/50 rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">
              Ready to Ingest
            </p>

            <div className="space-y-4">
              {liveHttp && (
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-text-muted/60 ml-1">
                    HTTP ENDPOINT
                  </span>
                  <div className="bg-bg-surface/50 border border-border p-3 rounded-xl font-mono text-[10px] text-primary break-all">
                    POST http://localhost:{settings.ingestion_http_port}/ingest/{activeWorkspaceId}/
                    {liveName || "my-collection"}
                  </div>
                </div>
              )}

              {liveSyslog && (
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-text-muted/60 ml-1">
                    SYSLOG TARGET (UDP)
                  </span>
                  <div className="bg-bg-surface/50 border border-border p-3 rounded-xl font-mono text-[10px] text-primary">
                    127.0.0.1:{settings.ingestion_syslog_port}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button
          disabled={!liveName.trim() || (!liveSyslog && !liveHttp) || isProcessing}
          size="lg"
          onClick={() => {
            onImportLive(liveName.trim(), { syslog: liveSyslog, http: liveHttp });
          }}
          className="font-black"
        >
          {isProcessing ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Wifi className="size-5" />
          )}
          {isProcessing ? "Starting..." : "Start Collection"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

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
