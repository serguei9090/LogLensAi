import { TailSwitch } from "@/components/atoms/TailSwitch";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  Activity,
  Code,
  Folder,
  FolderOpen,
  Info,
  Server,
  Terminal,
  Upload,
  Wifi,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner"; // For environmental feedback

/**
 * Detects whether the app is running inside a Tauri desktop shell.
 * When false, we're in web mode and must use browser-native file APIs.
 */
const isTauri = globalThis.window !== undefined && "__TAURI_INTERNALS__" in globalThis.window;

interface ImportFeedModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
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
  { id: "local", icon: FolderOpen, label: "Local File" },
  { id: "ssh", icon: Server, label: "SSH Remote" },
  { id: "manual", icon: Code, label: "Manual" },
  { id: "live", icon: Activity, label: "Live Ingestion" },
];

const inputCls =
  "w-full h-10 px-4 rounded-xl text-sm bg-bg-surface border border-border text-text-primary placeholder:text-text-muted/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-sans";

export function ImportFeedModal({
  open,
  onOpenChange,
  onImportLocal,
  onImportSSH,
  onIngestManual,
  onImportLive,
}: ImportFeedModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("local");
  const [localPath, setLocalPath] = useState("");
  const [localTail, setLocalTail] = useState(true);

  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshUser, setSshUser] = useState("");
  const [sshPass, setSshPass] = useState("");
  const [sshPath, setSshPath] = useState("");
  const [sshTail, setSshTail] = useState(true);
  const [manualLogs, setManualLogs] = useState("");

  const [liveName, setLiveName] = useState("");
  const [liveSyslog, setLiveSyslog] = useState(true);
  const [liveHttp, setLiveHttp] = useState(true);

  const { activeWorkspaceId } = useWorkspaceStore();
  const { settings } = useSettingsStore();

  if (!open) {
    return null;
  }

  const handleBrowse = async () => {
    if (isTauri) {
      // Desktop mode: use Tauri native file dialog
      try {
        const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
        const selected = await openDialog({
          multiple: false,
          directory: false,
          title: "Select Log Source",
          filters: [
            { name: "Common Logs", extensions: ["log", "syslog", "txt", "json", "csv"] },
            { name: "All Files", extensions: ["*"] },
          ],
        });

        if (selected) {
          setLocalPath(Array.isArray(selected) ? selected[0] : selected);
        }
      } catch (e) {
        console.warn("Native dialog error:", e);
        toast.error("Could not open file picker.");
      }
    } else {
      // Web mode: use browser file input
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

  const labelCls = "text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2 ml-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-bg-base/90 backdrop-blur-xl cursor-default border-none outline-none appearance-none"
        onClick={() => onOpenChange(false)}
        aria-label="Close modal"
      />

      <div className="relative z-10 w-full max-w-[560px] bg-bg-surface/60 border border-border/80 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        <div className="flex items-center justify-between px-10 py-8 border-b border-border/50 bg-white/[0.03]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-text-primary tracking-tight">Ingest Source</h2>
            </div>
            <p className="text-[13px] text-text-muted opacity-60">
              Connect a data source for real-time analysis
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 w-10 rounded-2xl flex items-center justify-center text-text-muted/50 hover:text-text-primary hover:bg-white/10 transition-all"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="px-10 mt-8">
          <div className="flex gap-1.5 bg-bg-base/80 rounded-2xl p-1.5 border border-border/60 shadow-inner">
            {TABS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[14px] text-xs font-bold transition-all",
                  activeTab === id
                    ? "bg-primary text-bg-base shadow-xl shadow-primary/20"
                    : "text-text-muted hover:text-text-secondary hover:bg-white/5",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-10 py-10 min-h-[340px]">
          {activeTab === "local" && (
            <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
              <div className="space-y-4">
                <label htmlFor="local-path" className={labelCls}>
                  Source File Path
                </label>
                <div className="flex gap-3">
                  <input
                    id="local-path"
                    placeholder="e.g. C:\logs\engine.log"
                    className={cn(inputCls, "flex-1 font-mono text-[11px] h-12")}
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleBrowse}
                    className="h-12 px-5 rounded-xl bg-bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-primary transition-all flex items-center gap-2 font-bold text-xs shrink-0 shadow-sm"
                  >
                    <Folder className="h-4 w-4" />
                    Browse
                  </button>
                </div>

                <div className="flex items-start gap-3 border border-info/20 bg-info/5 rounded-2xl p-4 transition-colors">
                  <Info className="h-5 w-5 shrink-0 mt-0.5 text-info" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-info">System Path Access</h4>
                    <p className="text-[11px] text-text-muted leading-relaxed opacity-80">
                      Full access to local system files enabled via Native API.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-6 border-t border-border/40">
                <TailSwitch
                  checked={localTail}
                  onCheckedChange={setLocalTail}
                  label="Activate Live Stream"
                />
                <button
                  type="button"
                  disabled={!localPath.trim()}
                  onClick={() => {
                    onImportLocal(localPath.trim(), localTail);
                    onOpenChange(false);
                  }}
                  className="inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-primary hover:bg-primary-hover disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed text-bg-base text-[13px] font-black transition-all shadow-[0_15px_30px_-5px_rgba(34,197,94,0.4)] hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Upload className="h-5 w-5" />
                  Initialize
                </button>
              </div>
            </div>
          )}

          {activeTab === "ssh" && (
            <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 space-y-2">
                  <label htmlFor="ssh-host" className={labelCls}>
                    Secure Host
                  </label>
                  <input
                    id="ssh-host"
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
                />
                <button
                  type="button"
                  disabled={!sshHost || !sshUser || !sshPath}
                  onClick={() => {
                    onImportSSH(sshHost, Number(sshPort), sshUser, sshPass, sshPath, sshTail);
                    onOpenChange(false);
                  }}
                  className="inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-primary hover:bg-primary-hover disabled:opacity-30 text-bg-base text-[13px] font-black transition-all shadow-xl shadow-primary/20"
                >
                  <Terminal className="h-5 w-5" />
                  Connect
                </button>
              </div>
            </div>
          )}

          {activeTab === "manual" && (
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
                <button
                  type="button"
                  disabled={!manualLogs.trim()}
                  onClick={() => {
                    onIngestManual(manualLogs.trim());
                    onOpenChange(false);
                  }}
                  className="inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-primary hover:bg-primary-hover disabled:opacity-30 text-bg-base text-[13px] font-black transition-all shadow-xl shadow-primary/20"
                >
                  <Upload className="h-5 w-5" />
                  Process Buffer
                </button>
              </div>
            </div>
          )}

          {activeTab === "live" && (
            <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="live-name" className={labelCls}>
                    Collection Label (Tab Name)
                  </label>
                  <input
                    id="live-name"
                    placeholder="e.g. Production Cluster"
                    className={cn(inputCls, "h-12")}
                    value={liveName}
                    onChange={(e) => setLiveName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setLiveSyslog(!liveSyslog)}
                    className={cn(
                      "p-5 rounded-2xl border transition-all text-left flex flex-col gap-2",
                      liveSyslog
                        ? "bg-primary/5 border-primary shadow-sm"
                        : "bg-bg-surface border-border opacity-60 hover:opacity-100",
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Wifi
                        className={cn("h-5 w-5", liveSyslog ? "text-primary" : "text-text-muted")}
                      />
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full transform transition-transform",
                          liveSyslog
                            ? "bg-primary scale-100 animate-pulse"
                            : "bg-text-muted scale-75",
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-xs font-bold",
                        liveSyslog ? "text-primary" : "text-text-muted",
                      )}
                    >
                      Syslog (UDP)
                    </span>
                    <span className="text-[10px] text-text-muted/60">
                      Passive listening on port 514
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLiveHttp(!liveHttp)}
                    className={cn(
                      "p-5 rounded-2xl border transition-all text-left flex flex-col gap-2",
                      liveHttp
                        ? "bg-primary/5 border-primary shadow-sm"
                        : "bg-bg-surface border-border opacity-60 hover:opacity-100",
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Terminal
                        className={cn("h-5 w-5", liveHttp ? "text-primary" : "text-text-muted")}
                      />
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full transform transition-transform",
                          liveHttp
                            ? "bg-primary scale-100 animate-pulse"
                            : "bg-text-muted scale-75",
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-xs font-bold",
                        liveHttp ? "text-primary" : "text-text-muted",
                      )}
                    >
                      HTTP API
                    </span>
                    <span className="text-[10px] text-text-muted/60">
                      POST endpoint on port 5002
                    </span>
                  </button>
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
                            POST http://localhost:{settings.ingestion_http_port}/ingest/
                            {activeWorkspaceId}/{liveName || "my-collection"}
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
                <button
                  type="button"
                  disabled={!liveName.trim() || (!liveSyslog && !liveHttp)}
                  onClick={() => {
                    onImportLive(liveName.trim(), { syslog: liveSyslog, http: liveHttp });
                    onOpenChange(false);
                  }}
                  className="inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-primary hover:bg-primary-hover disabled:opacity-30 text-bg-base text-[13px] font-black transition-all shadow-xl shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Wifi className="h-5 w-5" />
                  Start Collection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
