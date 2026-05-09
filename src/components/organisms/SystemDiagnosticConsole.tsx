import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDebugStore } from "@/store/debugStore";
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  Cpu,
  Database,
  Info,
  Monitor,
  Terminal,
  Trash2,
  X,
} from "lucide-react";

export function SystemDiagnosticConsole() {
  const { logs, isOpen, setOpen, clearLogs } = useDebugStore();
  const isEnabled = import.meta.env.VITE_DEBUG_GUI === "true";

  if (!isEnabled) {
    return null;
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertCircle className="size-3 text-red-400" />;
      case "warn":
        return <AlertTriangle className="size-3 text-amber-400" />;
      case "debug":
        return <Terminal className="size-3 text-blue-400" />;
      default:
        return <Info className="size-3 text-emerald-400" />;
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "tauri":
        return <Monitor className="size-2.5 mr-1" />;
      case "sidecar":
        return <Database className="size-2.5 mr-1" />;
      case "system":
        return <Cpu className="size-2.5 mr-1" />;
      default:
        return null;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "tauri":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "sidecar":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "system":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-4 right-4 z-[9999]">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOpen(!isOpen)}
          className={cn(
            "rounded-full size-10 shadow-2xl border-white/10 bg-bg-surface backdrop-blur-xl transition-all hover:scale-110 active:scale-95 group",
            isOpen ? "bg-primary text-white border-primary" : "hover:border-primary/50",
          )}
          title="Open System Diagnostic Console"
        >
          <Bug className={cn("size-5", isOpen && "animate-pulse")} />
          {!isOpen && logs.some((l) => l.level === "error") && (
            <span className="absolute top-0 right-0 size-2.5 bg-red-500 rounded-full border-2 border-bg-surface group-hover:animate-ping" />
          )}
        </Button>
      </div>

      {/* Slide-over Console */}
      <div
        className={cn(
          "fixed bottom-20 right-4 w-[450px] max-h-[600px] z-[9998] transition-all duration-500 ease-in-out transform origin-bottom-right flex flex-col",
          isOpen
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-4 pointer-events-none",
        )}
      >
        <div className="flex flex-col h-full bg-bg-surface/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Terminal className="size-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary tracking-tight">
                  System Diagnostic
                </h3>
                <p className="text-[10px] text-text-muted opacity-60 uppercase tracking-widest font-semibold">
                  {logs.length} entries recorded
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={clearLogs}
                title="Clear Logs"
                className="h-8 w-8 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                <Trash2 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-8 w-8 text-text-muted hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Logs List */}
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1">
              {logs.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-text-muted opacity-30">
                  <Terminal className="size-12 mb-3" />
                  <p className="text-xs font-medium uppercase tracking-widest">
                    Waiting for events...
                  </p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="group flex flex-col p-3 rounded-2xl hover:bg-white/[0.03] border border-transparent hover:border-white/5 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {getLevelIcon(log.level)}
                        <span className="text-[9px] font-mono text-text-muted opacity-50 font-medium">
                          {log.timestamp}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[8px] h-3.5 px-1.5 rounded-sm uppercase font-black tracking-tighter transition-all",
                            getSourceColor(log.source),
                          )}
                        >
                          {getSourceIcon(log.source)}
                          {log.source}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            JSON.stringify({ ...log, data: log.data }, null, 2),
                          );
                        }}
                        className="h-6 w-6 text-text-muted hover:text-primary hover:bg-primary/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Terminal className="size-3" />
                      </Button>
                    </div>
                    <p
                      className={cn(
                        "text-[11px] font-mono leading-normal break-all whitespace-pre-wrap",
                        log.level === "error"
                          ? "text-red-400"
                          : log.level === "warn"
                            ? "text-amber-400"
                            : "text-text-secondary",
                      )}
                    >
                      {log.message}
                    </p>
                    {log.data && (
                      <div className="mt-2 relative">
                        <pre className="p-2 bg-black/40 rounded-xl text-[9px] font-mono text-text-muted overflow-x-auto border border-white/5 max-h-40 custom-scrollbar">
                          {typeof log.data === "string"
                            ? log.data
                            : JSON.stringify(log.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  );
}
