import { TailSwitch } from "@/components/atoms/TailSwitch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIngestionStore } from "@/store/ingestion";
import { FileText, Upload, X } from "lucide-react";
import { labelCls } from "../constants";
import type { LocalTabProps } from "../types";

export function LocalTab({
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
                <span className="text-xs text-text-muted/60 truncate font-mono">
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
              <FileText className="h-8 w-8 text-primary scale-110 -translate-y-1 transition-transform duration-200 ease-out" />
            ) : (
              <Upload className="h-8 w-8 text-text-muted/40 animate-pulse motion-reduce:animate-none" />
            )}
            <div className="text-center">
              <p className="text-xs font-semibold text-text-primary">
                {isDragOver ? "Drop your file here!" : "Drag & Drop log file here"}
              </p>
              <p className="text-xs text-text-muted/60 mt-1">
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
