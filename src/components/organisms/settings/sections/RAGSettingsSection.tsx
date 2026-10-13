import { HardwareAcceleration } from "@/components/molecules/HardwareAcceleration";
import {
  ModelWeightsStatus,
  type ModelWeightsStatusData,
} from "@/components/molecules/ModelWeightsStatus";
import { Button } from "@/components/ui/button";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import type { AppSettings } from "@/store/settingsStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { BookOpen, FolderOpen, HardDrive, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SectionLabel } from "../components/SectionLabel";
import { SettingInput } from "../components/SettingInput";
import { SettingSelect } from "../components/SettingSelect";

const isTauri = typeof globalThis !== "undefined" && "__TAURI_INTERNALS__" in globalThis;

interface RAGSettingsSectionProps {
  readonly settings: AppSettings;
  readonly update: <K extends keyof AppSettings>(
    key: K,
    val: AppSettings[K],
    saveImmediately?: boolean,
  ) => void;
  readonly onSave: (settings: AppSettings) => void;
}

export function RAGSettingsSection({ settings, update, onSave }: RAGSettingsSectionProps) {
  const [isReindexing, setIsReindexing] = useState(false);
  const [indexStats, setIndexStats] = useState<{
    totalFiles?: number;
    totalChunks?: number;
  } | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelWeightsStatusData | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const resolvedDefaultPath = "knowledge";

  // Fetch RAG model status on mount
  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        setIsStatusLoading(true);
        const res = await callSidecar<ModelWeightsStatusData>({
          method: "get_rag_model_status",
          params: { workspace_id: activeWorkspaceId || "default" },
          silent: true,
        });
        if (active && res) {
          setModelStatus(res);
        }
      } catch (err) {
        console.warn("Failed to fetch RAG model status:", err);
      } finally {
        if (active) {
          setIsStatusLoading(false);
        }
      }
    };
    fetchStatus();
    return () => {
      active = false;
    };
  }, [activeWorkspaceId]);

  const handleDownloadModel = async () => {
    try {
      setModelStatus((prev) =>
        prev
          ? { ...prev, state: "downloading", error_message: undefined }
          : {
              state: "downloading",
              progress: 0,
              downloaded_bytes: 0,
              total_bytes: 310 * 1024 * 1024,
            },
      );
      const res = await callSidecar<ModelWeightsStatusData>({
        method: "download_rag_model",
        params: { workspace_id: activeWorkspaceId || "default" },
      });
      if (res) {
        setModelStatus(res);
      }
      toast.info("Started background download of EmbeddingGemma-2 weights from Hugging Face");

      // Poll status every 1.5 seconds while downloading
      const pollInterval = setInterval(async () => {
        try {
          const status = await callSidecar<ModelWeightsStatusData>({
            method: "get_rag_model_status",
            params: { workspace_id: activeWorkspaceId || "default" },
            silent: true,
          });
          if (status) {
            setModelStatus(status);
            if (status.state === "ready" || status.state === "error" || status.state === "idle") {
              clearInterval(pollInterval);
              if (status.state === "ready") {
                toast.success("EmbeddingGemma-2 model weights are ready!");
              }
            }
          }
        } catch {
          clearInterval(pollInterval);
        }
      }, 1500);
    } catch (_err) {
      toast.error("Failed to start model download");
    }
  };

  const handleBrowseFolder = async () => {
    if (isTauri) {
      try {
        const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
        const selected = await openDialog({
          directory: true,
          multiple: false,
          title: "Select Knowledge Base Directory",
        });

        if (selected) {
          const folderPath = Array.isArray(selected) ? selected[0] : selected;
          update("rag_knowledge_path", folderPath, true);
          toast.success(`Knowledge folder updated: ${folderPath}`);
        }
      } catch (err) {
        console.warn("Tauri directory picker failed:", err);
        toast.error("Could not open desktop directory picker");
      }
    } else {
      // Browser fallback using HTML directory picker
      const input = document.createElement("input");
      input.type = "file";
      // webkitdirectory and directory allow folder picking in Chromium/Firefox/Safari
      input.setAttribute("webkitdirectory", "");
      input.setAttribute("directory", "");
      input.setAttribute("multiple", "");

      input.onchange = () => {
        const files = input.files;
        if (files && files.length > 0) {
          const firstFile = files[0];
          // In browser, relativePath is usually "folderName/fileName.ext"
          const relativePath = firstFile.webkitRelativePath || firstFile.name;
          const folderName =
            relativePath.split("/")[0] || relativePath.split("\\")[0] || firstFile.name;
          update("rag_knowledge_path", folderName, true);
          toast.success(`Knowledge folder set to: ${folderName}`);
        }
      };
      input.click();
    }
  };

  const handleReindex = async () => {
    setIsReindexing(true);
    try {
      const res = await callSidecar<{ status: string; total_files: number; total_chunks: number }>({
        method: "sync_knowledge_base",
        params: {
          workspace_id: activeWorkspaceId || "default",
          knowledge_path: settings.rag_knowledge_path || undefined,
        },
      });
      setIndexStats({ totalFiles: res.total_files, totalChunks: res.total_chunks });
      toast.success(`Knowledge base indexed: ${res.total_files} files, ${res.total_chunks} chunks`);
    } catch (err) {
      console.error("Re-indexing failed:", err);
      toast.error("Failed to re-index knowledge base. Check console for details.");
    } finally {
      setIsReindexing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="border-b border-border pb-6">
        <h2 className="text-2xl font-bold text-text-primary flex items-center gap-3">
          <BookOpen className="size-6 text-primary" />
          Knowledge Base & Resolution RAG
        </h2>
        <p className="text-sm text-text-muted mt-2">
          Embed local documentation, runbooks, architecture diagrams, and incident resolution
          memories using on-device models.
        </p>
      </div>

      <div className="space-y-6">
        {/* Embedder Engine */}
        <div className="space-y-2">
          <SectionLabel htmlFor="rag_embedder_type">Embedding Model Engine</SectionLabel>
          <SettingSelect
            id="rag_embedder_type"
            value={settings.rag_embedder_type || "onnx"}
            onChange={(v) => {
              update("rag_embedder_type", v as "onnx" | "ollama", true);
            }}
          >
            <option value="onnx">EmbeddingGemma-2 (Local ONNX Q8)</option>
            <option value="ollama">EmbeddingGemma-2 (Local Ollama)</option>
          </SettingSelect>
          <p className="text-xs text-text-muted mt-1">
            Natively produces 768-dim embeddings matching DuckDB vector storage with zero cloud
            leaks.
          </p>
        </div>

        {/* Hardware Acceleration (Visual parity with Laya AI) - Only applicable for local ONNX execution */}
        {(settings.rag_embedder_type ?? "onnx") === "onnx" && (
          <HardwareAcceleration
            currentDevice={settings.rag_device || "cpu"}
            onDeviceChange={(device) => update("rag_device", device, true)}
            title="Embedding Hardware Acceleration"
            tooltip="Select CPU execution to keep all GPU memory free, or GPU (DirectML/CUDA) for batch indexing acceleration."
            cpuRamText="RAM: ~320 MB"
            gpuRamText="RAM: ~100 MB"
            gpuVramText="VRAM: ~400 MB"
            latencyTextCpu="Latency: ~50–80 ms"
            latencyTextGpu="Latency: ~15–25 ms"
          />
        )}

        {/* Model Weights & Local Cache Status - Only for Local ONNX */}
        {(settings.rag_embedder_type ?? "onnx") === "onnx" && (
          <ModelWeightsStatus
            modelStatus={modelStatus}
            isLoading={isStatusLoading}
            onDownloadModel={handleDownloadModel}
            title="Embedding Model Weights"
            modelTag="EmbeddingGemma-2 (ONNX Q8 ~310 MB)"
            tooltip="Quantized 8-bit EmbeddingGemma-2 weights cached locally in rag_model/ to produce 768-dim embeddings with 100% offline privacy."
            fallbackNotice="Model Not Downloaded"
            sizeLabel="310 MB"
            downloadingDetail="Downloading tokenizer.json and onnx/model_int8.onnx..."
          />
        )}
      </div>

      {settings.rag_embedder_type === "ollama" && (
        <div className="space-y-2">
          <SectionLabel htmlFor="rag_ollama_host">Local Ollama Endpoint</SectionLabel>
          <SettingInput
            id="rag_ollama_host"
            value={settings.rag_ollama_host || "http://localhost:11434"}
            placeholder="http://localhost:11434"
            onChange={(e) => update("rag_ollama_host", e.target.value)}
            onBlur={() => onSave(settings)}
          />
        </div>
      )}

      {/* Knowledge Folder Location */}
      <div className="space-y-4 pt-4 border-t border-border/50">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionLabel htmlFor="rag_knowledge_path">Knowledge Folder Path</SectionLabel>
            <span className="text-[11px] font-mono text-text-muted flex items-center gap-1.5 bg-bg-surface px-2 py-0.5 rounded border border-border">
              <span className="text-text-muted">Default:</span>
              <span className="text-emerald-400 font-semibold">{resolvedDefaultPath}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SettingInput
                id="rag_knowledge_path"
                value={settings.rag_knowledge_path || ""}
                placeholder={`Leave blank to use default (${resolvedDefaultPath})`}
                onChange={(e) => update("rag_knowledge_path", e.target.value)}
                onBlur={() => onSave(settings)}
                className="font-mono text-xs pr-10"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleBrowseFolder}
              className="shrink-0 font-bold border-border hover:bg-bg-surface/80 flex items-center gap-2 px-3 text-xs"
            >
              <FolderOpen className="size-4 text-primary" />
              Browse
            </Button>
          </div>
          <div className="text-xs text-text-muted space-y-1.5 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-text-secondary font-medium">Active Effective Path:</span>
              <code className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                {settings.rag_knowledge_path?.trim()
                  ? settings.rag_knowledge_path
                  : resolvedDefaultPath}
              </code>
            </div>
            <p>
              Target folder contains your team&apos;s runbooks, guides (
              <code className="text-primary font-mono">.md</code>,{" "}
              <code className="text-primary font-mono">.txt</code>,{" "}
              <code className="text-primary font-mono">.pdf</code>), and diagrams (
              <code className="text-primary font-mono">.png</code>,{" "}
              <code className="text-primary font-mono">.jpg</code>).
            </p>
            <p className="text-text-secondary">
              Incident memories saved by the AI agent are written to:{" "}
              <span className="font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {settings.rag_knowledge_path?.trim() || resolvedDefaultPath}/Memory/*.md
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Indexing Actions & Stats */}
      <div className="p-4 rounded-2xl bg-bg-surface/50 border border-border/60 flex items-center justify-between">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <HardDrive className="size-4 text-emerald-400" />
            DuckDB Vector Index Status
          </h4>
          <p className="text-xs text-text-muted">
            {indexStats
              ? `Indexed: ${indexStats.totalFiles} files across ${indexStats.totalChunks} semantic chunks.`
              : "Background fsnotify watcher is active. Click below to trigger a complete scan."}
          </p>
        </div>

        <Button
          onClick={handleReindex}
          disabled={isReindexing}
          className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 h-9 font-bold text-xs uppercase tracking-wider"
        >
          {isReindexing ? (
            <>
              <Loader2 className="size-3.5 mr-2 animate-spin" />
              Indexing...
            </>
          ) : (
            <>
              <RefreshCw className="size-3.5 mr-2" />
              Re-index Knowledge Folder
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
