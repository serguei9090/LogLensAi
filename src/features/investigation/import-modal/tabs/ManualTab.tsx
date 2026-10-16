import { Button } from "@/components/ui/button";
import { useIngestionStore } from "@/store/ingestion";
import { Upload } from "lucide-react";
import { labelCls } from "../constants";
import type { ManualTabProps } from "../types";

export function ManualTab({ manualLogs, setManualLogs, onIngestManual }: ManualTabProps) {
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
            className="relative w-full px-5 py-4 rounded-2xl text-xs font-mono bg-bg-surface border border-border text-text-primary placeholder:text-text-muted/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 resize-none transition-all"
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
