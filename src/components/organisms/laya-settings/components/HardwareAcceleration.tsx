import { HelpTooltip } from "@/components/atoms/HelpTooltip";
import { cn } from "@/lib/utils";
import { Check, Cpu } from "lucide-react";

export interface HardwareAccelerationProps {
  readonly currentDevice: "cpu" | "gpu";
  readonly onDeviceChange: (device: "cpu" | "gpu") => void;
}

export function HardwareAcceleration({
  currentDevice,
  onDeviceChange,
}: Readonly<HardwareAccelerationProps>) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted font-mono">
          Hardware Acceleration & Runtime
        </h4>
        <HelpTooltip content="Select CPU execution to keep all GPU VRAM available for local generative LLMs, or GPU acceleration for lowest latency." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* CPU Card */}
        <button
          type="button"
          onClick={() => onDeviceChange("cpu")}
          className={cn(
            "p-4 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer",
            currentDevice === "cpu"
              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
              : "border-border bg-bg-surface hover:border-border/80 hover:bg-bg-surface/80",
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">CPU Mode</span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-bg-base border border-border text-text-muted">
                Zero VRAM
              </span>
              <HelpTooltip content="Uses ONNX Runtime OpenMP threads. Leaves 100% of your GPU memory free for local LLMs in Ollama." />
            </div>
            {currentDevice === "cpu" && (
              <span className="flex items-center gap-1 text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md font-medium">
                <Check className="h-3 w-3" /> Selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono flex-wrap pt-1">
            <span className="px-2 py-0.5 rounded bg-bg-base/80 border border-border/60 text-text-muted">
              RAM: ~520 MB
            </span>
            <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-medium">
              VRAM: 0 MB
            </span>
            <span className="px-2 py-0.5 rounded bg-bg-base/80 border border-border/60 text-text-muted">
              Latency: ~45–70 ms
            </span>
          </div>
        </button>

        {/* GPU Card */}
        <button
          type="button"
          onClick={() => onDeviceChange("gpu")}
          className={cn(
            "p-4 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer",
            currentDevice === "gpu"
              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
              : "border-border bg-bg-surface hover:border-border/80 hover:bg-bg-surface/80",
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">GPU Acceleration</span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-bg-base border border-border text-text-muted">
                DirectML / CUDA
              </span>
              <HelpTooltip content="Leverages DirectML or NVIDIA CUDA for maximum inference speed and lowest latency (~3x faster)." />
            </div>
            {currentDevice === "gpu" && (
              <span className="flex items-center gap-1 text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md font-medium">
                <Check className="h-3 w-3" /> Selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono flex-wrap pt-1">
            <span className="px-2 py-0.5 rounded bg-bg-base/80 border border-border/60 text-text-muted">
              RAM: ~120 MB
            </span>
            <span className="px-2 py-0.5 rounded bg-bg-base/80 border border-border/60 text-text-muted">
              VRAM: ~550 MB
            </span>
            <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-medium">
              Latency: ~18–25 ms
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
