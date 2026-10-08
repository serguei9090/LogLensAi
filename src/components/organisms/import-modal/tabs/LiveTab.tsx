import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIngestionStore } from "@/store/ingestion";
import { Info, Terminal, Wifi } from "lucide-react";
import { inputCls, labelCls } from "../constants";
import type { LiveTabProps } from "../types";

export function LiveTab({
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
            <span className="text-xs text-text-muted/60">Passive listening on port 514</span>
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
            <span className="text-xs text-text-muted/60">POST endpoint on port 5002</span>
          </Button>
        </div>

        <div className="flex items-start gap-3 border border-orange-500/20 bg-orange-500/5 rounded-2xl p-4">
          <Info className="h-5 w-5 shrink-0 mt-0.5 text-orange-500" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-orange-500 uppercase tracking-tight">
              Configuration Note
            </p>
            <p className="text-xs text-text-muted leading-relaxed opacity-80">
              Ports are managed globally in **Settings**. All traffic matching the selected
              protocols will be routed to this workspace using the label above.
            </p>
          </div>
        </div>

        {(liveHttp || liveSyslog) && (
          <div className="bg-bg-dark/50 border border-border/50 rounded-2xl p-5 space-y-4">
            <p className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1">
              Ready to Ingest
            </p>

            <div className="space-y-4">
              {liveHttp && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-text-muted/60 ml-1">
                    HTTP ENDPOINT
                  </span>
                  <div className="bg-bg-surface/50 border border-border p-3 rounded-xl font-mono text-xs text-primary break-all">
                    POST http://localhost:{settings.ingestion_http_port}/ingest/{activeWorkspaceId}/
                    {liveName || "my-collection"}
                  </div>
                </div>
              )}

              {liveSyslog && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-text-muted/60 ml-1">
                    SYSLOG TARGET (UDP)
                  </span>
                  <div className="bg-bg-surface/50 border border-border p-3 rounded-xl font-mono text-xs text-primary">
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
