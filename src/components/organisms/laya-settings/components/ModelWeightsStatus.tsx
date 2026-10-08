import { HelpTooltip } from "@/components/atoms/HelpTooltip";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Download, HardDrive, Loader2 } from "lucide-react";

export interface ModelWeightsStatusProps {
  readonly modelStatus: {
    state: "ready" | "downloading" | "idle" | "error";
    progress: number;
    downloaded_bytes: number;
    total_bytes: number;
    error_message?: string;
  } | null;
  readonly onDownloadModel: () => void;
}

export function ModelWeightsStatus({
  modelStatus,
  onDownloadModel,
}: Readonly<ModelWeightsStatusProps>) {
  return (
    <div className="p-4 rounded-xl border border-border bg-bg-surface">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <HardDrive className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted font-mono">
            Model Weights & Local Cache
          </h4>
          <span className="text-xs font-mono text-text-muted hidden sm:inline">
            nvkudva/laya-web-q8 (524 MB)
          </span>
          <HelpTooltip content="Quantized 8-bit ModernBERT ONNX weights cached locally to accelerate non-autoregressive log routing and triage." />
        </div>
        <div className="flex items-center gap-3">
          {modelStatus?.state === "ready" && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" /> Local Weights Ready
            </span>
          )}
          {modelStatus?.state === "downloading" && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Downloading{" "}
              {modelStatus.progress.toFixed(1)}%
            </span>
          )}
          {(!modelStatus || modelStatus.state === "idle") && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                <AlertCircle className="h-3.5 w-3.5" /> Simulated Fallback
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={onDownloadModel}
                className="h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
              >
                <Download className="h-3.5 w-3.5" /> Download (524 MB)
              </Button>
            </div>
          )}
          {modelStatus?.state === "error" && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full">
                <AlertCircle className="h-3.5 w-3.5" /> Download Error
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={onDownloadModel}
                className="h-7 text-xs gap-1.5 border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
              >
                <Download className="h-3.5 w-3.5" /> Retry (524 MB)
              </Button>
            </div>
          )}
        </div>
      </div>

      {modelStatus?.state === "downloading" && (
        <div className="space-y-2 pt-3 border-t border-border/40 mt-3">
          <div className="w-full bg-border/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(2, modelStatus.progress)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-text-muted">
            <span>Downloading encoder_q8.onnx and head_q8.onnx...</span>
            <span>
              {(modelStatus.downloaded_bytes / (1024 * 1024)).toFixed(1)} MB /{" "}
              {(modelStatus.total_bytes / (1024 * 1024)).toFixed(1)} MB
            </span>
          </div>
        </div>
      )}

      {modelStatus?.state === "error" && modelStatus.error_message && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span className="font-mono text-xs">{modelStatus.error_message}</span>
        </div>
      )}
    </div>
  );
}
