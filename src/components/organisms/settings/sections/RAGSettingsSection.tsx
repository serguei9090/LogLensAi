import { Button } from "@/components/ui/button";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import type { AppSettings } from "@/store/settingsStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { BookOpen, Check, Cpu, FolderOpen, HardDrive, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SectionLabel } from "../components/SectionLabel";
import { SettingInput } from "../components/SettingInput";
import { SettingSelect } from "../components/SettingSelect";

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
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const defaultFolder = settings.rag_knowledge_path || "knowledge";

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

      <div className="grid grid-cols-2 gap-8">
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

        {/* Hardware Acceleration */}
        <div className="space-y-2">
          <SectionLabel htmlFor="rag_device">Hardware Acceleration</SectionLabel>
          <SettingSelect
            id="rag_device"
            value={settings.rag_device || "cpu"}
            onChange={(v) => {
              update("rag_device", v as "cpu" | "gpu", true);
            }}
          >
            <option value="cpu">CPU (Universal Execution, 0 MB VRAM)</option>
            <option value="gpu">GPU (DirectML / CUDA Hardware Accelerated)</option>
          </SettingSelect>
          <p className="text-xs text-text-muted mt-1">
            Select CPU for background efficiency or GPU for batch indexing acceleration.
          </p>
        </div>
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
          <SectionLabel htmlFor="rag_knowledge_path">Knowledge Folder Path</SectionLabel>
          <div className="flex gap-2">
            <SettingInput
              id="rag_knowledge_path"
              value={settings.rag_knowledge_path || ""}
              placeholder="Leave blank to use default workspace directory (knowledge/)"
              onChange={(e) => update("rag_knowledge_path", e.target.value)}
              onBlur={() => onSave(settings)}
            />
          </div>
          <div className="text-xs text-text-muted space-y-1">
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
                {defaultFolder}/Memory/*.md
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
