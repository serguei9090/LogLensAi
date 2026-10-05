// Assume Role: Frontend Engineer (@frontend)

import { HelpTooltip } from "@/components/atoms/HelpTooltip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useLayaStore } from "@/store/layaStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { QuestionType } from "@/types/laya";
import {
  Activity,
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  Code2,
  Cpu,
  Download,
  HardDrive,
  History,
  Info,
  Layers,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function LayaSettingsPanel() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const {
    settings,
    checkpoints,
    modelStatus,
    isTesting,
    testResult,
    fetchSettings,
    updateSettings,
    fetchCheckpoints,
    downloadModel,
    rollbackCheckpoint,
    saveRules,
    testRule,
    clearTestResult,
  } = useLayaStore();

  const [activeTab, setActiveTab] = useState<"visual" | "json" | "history" | "test">("visual");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // New/Edit Question Modal State
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<QuestionType>("choice");
  const [ruleInstructions, setRuleInstructions] = useState("");
  const [ruleOptions, setRuleOptions] = useState("");
  const [ruleRubric, setRuleRubric] = useState("1, 2, 3, 4, 5");

  // Save Checkpoint Modal State
  const [isSaveCheckpointOpen, setIsSaveCheckpointOpen] = useState(false);
  const [checkpointAuthor, setCheckpointAuthor] = useState("User");
  const [checkpointDesc, setCheckpointDesc] = useState("");

  // Rollback Modal State
  const [rollbackTargetId, setRollbackTargetId] = useState<string | null>(null);

  // Guide / Documentation Modal State
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  // Test Playground State
  const [testText, setTestText] = useState(
    "ERROR 2026-09-30 11:42:01 [database] Connection pool exhausted: 150/150 connections active",
  );
  const [selectedQuestionName, setSelectedQuestionName] = useState("category");

  useEffect(() => {
    fetchSettings(activeWorkspaceId);
    fetchCheckpoints(activeWorkspaceId);
  }, [activeWorkspaceId, fetchSettings, fetchCheckpoints]);

  useEffect(() => {
    if (settings.questions) {
      setJsonText(JSON.stringify(settings.questions, null, 2));
      setJsonError(null);
    }
  }, [settings.questions]);

  const questionsList = useMemo(() => {
    return Object.entries(settings.questions || {}).map(([name, q]) => ({
      name,
      ...q,
    }));
  }, [settings.questions]);

  const handleToggleEnabled = async (checked: boolean) => {
    try {
      await updateSettings({ enabled: checked, workspaceId: activeWorkspaceId });
      toast.success(checked ? "Laya System 1 Accelerator enabled" : "Laya System 1 Accelerator disabled");
    } catch {
      toast.error("Failed to update Laya setting");
    }
  };

  const handleDeviceChange = async (device: "cpu" | "gpu") => {
    try {
      await updateSettings({ device, workspaceId: activeWorkspaceId });
      toast.success(`Hardware acceleration set to ${device.toUpperCase()}`);
    } catch {
      toast.error("Failed to switch hardware mode");
    }
  };

  const handleDownloadModel = async () => {
    try {
      await downloadModel(activeWorkspaceId);
      toast.info("Started background download of Laya ONNX weights from Hugging Face");
    } catch {
      toast.error("Failed to start model download");
    }
  };


  const handleSaveJsonRules = async () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("JSON must be a key-value object of questions");
      }
      await saveRules(
        "User (JSON Editor)",
        checkpointDesc.trim() || "Manual JSON rule update",
        parsed,
        activeWorkspaceId,
      );
      setIsSaveCheckpointOpen(false);
      setCheckpointDesc("");
      toast.success("New checkpoint committed and activated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid JSON format");
    }
  };

  const handleSaveVisualRule = async () => {
    const trimmedName = ruleName.trim();
    if (!trimmedName) {
      toast.error("Rule name is required");
      return;
    }
    if (!ruleInstructions.trim()) {
      toast.error("Instructions prompt is required");
      return;
    }

    const updatedQuestions = { ...(settings.questions || {}) };

    if (ruleType === "choice") {
      const opts = ruleOptions
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (opts.length === 0) {
        toast.error("At least one option is required for choice rules");
        return;
      }
      updatedQuestions[trimmedName] = {
        type: "choice",
        instructions: ruleInstructions.trim(),
        options: opts,
      };
    } else if (ruleType === "score") {
      const rubric = ruleRubric
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n));
      if (rubric.length === 0) {
        toast.error("At least one rubric level number is required for score rules");
        return;
      }
      updatedQuestions[trimmedName] = {
        type: "score",
        instructions: ruleInstructions.trim(),
        rubric,
      };
    } else {
      updatedQuestions[trimmedName] = {
        type: "noul",
        instructions: ruleInstructions.trim(),
      };
    }

    try {
      await saveRules(
        "User (Visual Builder)",
        `Updated rule: ${trimmedName}`,
        updatedQuestions,
        activeWorkspaceId,
      );
      setIsAddRuleOpen(false);
      setRuleName("");
      setRuleInstructions("");
      setRuleOptions("");
      toast.success(`Rule "${trimmedName}" saved as new checkpoint`);
    } catch {
      toast.error("Failed to save rule");
    }
  };

  const handleDeleteRule = async (nameToDelete: string) => {
    const updated = { ...(settings.questions || {}) };
    delete updated[nameToDelete];
    try {
      await saveRules(
        "User (Visual Builder)",
        `Deleted rule: ${nameToDelete}`,
        updated,
        activeWorkspaceId,
      );
      toast.success(`Rule "${nameToDelete}" removed`);
    } catch {
      toast.error("Failed to delete rule");
    }
  };

  const handleConfirmRollback = async () => {
    if (!rollbackTargetId) return;
    try {
      await rollbackCheckpoint(rollbackTargetId, activeWorkspaceId);
      toast.success(`Successfully rolled back to checkpoint ${rollbackTargetId}`);
      setRollbackTargetId(null);
    } catch {
      toast.error("Rollback failed");
    }
  };

  const handleRunTest = async () => {
    if (!testText.trim()) {
      toast.error("Please provide text to evaluate");
      return;
    }
    clearTestResult();
    const res = await testRule(testText.trim(), selectedQuestionName, undefined, activeWorkspaceId);
    if (res) {
      toast.success(`Evaluation complete: ${res.selected_label}`);
    } else {
      toast.error("Evaluation returned no result");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner & Accelerator Switch */}
      <div className="p-6 rounded-2xl bg-bg-surface border border-border/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-text-primary tracking-tight">
              Laya System 1 Decision Engine
            </h3>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
              ModernBERT 8-bit
            </span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed max-w-2xl">
            Non-autoregressive decision engine that performs ultra-fast tool routing, log severity scoring,
            and cluster triage in ~30ms before touching costly generative LLMs.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsGuideModalOpen(true)}
            className="h-8 text-xs font-medium gap-1.5 border-border hover:border-primary text-text-primary"
          >
            <BookOpen className="h-3.5 w-3.5 text-primary" /> Guide & Primitives
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <span className="text-xs font-medium text-text-muted">
            {settings.enabled ? "Active" : "Disabled"}
          </span>
          <Switch
            checked={settings.enabled}
            onCheckedChange={handleToggleEnabled}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>

      {/* Hardware Acceleration Mode (CPU Zero-VRAM vs GPU) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted font-mono">
            Hardware Acceleration & Memory Profile
          </h4>
          <HelpTooltip content="CPU mode runs with 0 MB GPU VRAM footprint, leaving your entire GPU memory free for running 8B/14B models in Ollama." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CPU Card */}
          <button
            type="button"
            onClick={() => handleDeviceChange("cpu")}
            className={cn(
              "p-4 rounded-xl border text-left transition-all relative overflow-hidden",
              settings.device === "cpu"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-bg-surface hover:border-border/80",
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-text-primary">CPU Mode (Zero VRAM)</span>
              {settings.device === "cpu" && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  <Check className="h-3 w-3" /> Selected
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mb-3">
              Uses ONNX Runtime OpenMP threads. Leaves 100% of your GPU memory free for local LLMs.
            </p>
            <div className="flex items-center gap-4 text-[11px] font-mono text-text-muted/80">
              <span>RAM: ~520 MB</span>
              <span className="text-primary font-semibold">VRAM: 0 MB</span>
              <span>Latency: ~45–70 ms</span>
            </div>
          </button>

          {/* GPU Card */}
          <button
            type="button"
            onClick={() => handleDeviceChange("gpu")}
            className={cn(
              "p-4 rounded-xl border text-left transition-all relative overflow-hidden",
              settings.device === "gpu"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-bg-surface hover:border-border/80",
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-text-primary">GPU Acceleration (DirectML / CUDA)</span>
              {settings.device === "gpu" && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  <Check className="h-3 w-3" /> Selected
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mb-3">
              Leverages DirectML or NVIDIA CUDA for maximum inference speed and lowest latency.
            </p>
            <div className="flex items-center gap-4 text-[11px] font-mono text-text-muted/80">
              <span>RAM: ~120 MB</span>
              <span>VRAM: ~550 MB</span>
              <span className="text-primary font-semibold">Latency: ~18–25 ms</span>
            </div>
          </button>
        </div>
      </div>

      {/* Model Weights & Local Cache Status */}
      <div className="p-4 rounded-xl border border-border bg-bg-surface space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted font-mono">
              Model Weights & Local Cache
            </h4>
            <span className="text-[10px] font-mono text-text-muted hidden sm:inline">
              nvkudva/laya-web-q8 (524 MB)
            </span>
          </div>
          <div>
            {modelStatus?.state === "ready" && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="h-3.5 w-3.5" /> Local Weights Ready
              </span>
            )}
            {modelStatus?.state === "downloading" && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Downloading {modelStatus.progress.toFixed(1)}%
              </span>
            )}
            {(!modelStatus || modelStatus.state === "idle") && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                <AlertCircle className="h-3.5 w-3.5" /> Simulated Fallback Mode
              </span>
            )}
            {modelStatus?.state === "error" && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full">
                <AlertCircle className="h-3.5 w-3.5" /> Download Error
              </span>
            )}
          </div>
        </div>

        {modelStatus?.state === "downloading" ? (
          <div className="space-y-2 pt-1">
            <div className="w-full bg-border/60 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(2, modelStatus.progress)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-text-muted">
              <span>Downloading encoder_q8.onnx and head_q8.onnx...</span>
              <span>
                {(modelStatus.downloaded_bytes / (1024 * 1024)).toFixed(1)} MB /{" "}
                {(modelStatus.total_bytes / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-xs text-text-muted max-w-xl">
                {modelStatus?.state === "ready"
                  ? "Quantized 8-bit ModernBERT ONNX weights are cached locally and accelerating log analysis."
                  : "LogLensAi operates with a built-in heuristic simulation when weights are not downloaded. Download the official 524 MB weights for full ModernBERT accuracy."}
              </p>
              {modelStatus?.state !== "ready" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadModel}
                  className="shrink-0 gap-2 border-primary/40 text-primary hover:bg-primary/10"
                >
                  <Download className="h-3.5 w-3.5" />
                  {modelStatus?.state === "error" ? "Retry Download (524 MB)" : "Download Weights (524 MB)"}
                </Button>
              )}
            </div>
            {modelStatus?.state === "error" && modelStatus.error_message && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span className="font-mono text-[11px]">{modelStatus.error_message}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-1 bg-bg-surface p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setActiveTab("visual")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5",
                activeTab === "visual"
                  ? "bg-primary text-black font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-primary",
              )}
            >
              <Layers className="h-3.5 w-3.5" /> Visual Rules ({questionsList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("json")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5",
                activeTab === "json"
                  ? "bg-primary text-black font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-primary",
              )}
            >
              <Code2 className="h-3.5 w-3.5" /> JSON Code
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5",
                activeTab === "history"
                  ? "bg-primary text-black font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-primary",
              )}
            >
              <History className="h-3.5 w-3.5" /> Checkpoints ({checkpoints.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("test")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5",
                activeTab === "test"
                  ? "bg-primary text-black font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-primary",
              )}
            >
              <Play className="h-3.5 w-3.5" /> Test Playground
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "visual" && (
              <Button
                size="sm"
                onClick={() => setIsAddRuleOpen(true)}
                className="h-8 text-xs font-medium gap-1.5 bg-primary text-black hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" /> Add Rule
              </Button>
            )}
            {activeTab === "json" && (
              <Button
                size="sm"
                onClick={() => setIsSaveCheckpointOpen(true)}
                className="h-8 text-xs font-medium gap-1.5 bg-primary text-black hover:bg-primary/90"
              >
                <Sparkles className="h-3.5 w-3.5" /> Commit Checkpoint
              </Button>
            )}
          </div>
        </div>

        {/* TAB 1: Visual Rules Builder */}
        {activeTab === "visual" && (
          questionsList.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-border rounded-xl">
              <Layers className="h-8 w-8 text-text-muted mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-text-primary">No classification rules configured</p>
              <p className="text-xs text-text-muted mt-1 mb-4">Add your first custom rule to begin fast classification.</p>
              <Button size="sm" onClick={() => setIsAddRuleOpen(true)} className="gap-1.5 bg-primary text-black hover:bg-primary/90">
                <Plus className="h-3.5 w-3.5" /> Add Rule
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questionsList.map((q) => (
              <div
                key={q.name}
                className="p-5 rounded-xl border border-border bg-bg-surface/80 flex flex-col justify-between space-y-4 hover:border-border/90 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-text-primary">{q.name}</span>
                      <span
                        className={cn(
                          "text-[10px] uppercase font-mono px-2 py-0.5 rounded-md font-semibold",
                          q.type === "choice" && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                          q.type === "score" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                          q.type === "noul" && "bg-purple-500/10 text-purple-400 border border-purple-500/20",
                        )}
                      >
                        {q.type}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRule(q.name)}
                      className="text-text-muted hover:text-red-400 transition-colors p-1"
                      title="Delete rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed italic">
                    "{q.instructions}"
                  </p>
                </div>

                {/* Options or Rubric tags */}
                <div className="pt-2 border-t border-border/50">
                  {q.type === "choice" && q.options && (
                    <div className="flex flex-wrap gap-1.5">
                      {q.options.map((opt) => (
                        <span
                          key={opt}
                          className="text-[11px] font-mono bg-bg-surface-active px-2 py-0.5 rounded-md border border-border/60 text-text-primary"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}

                  {q.type === "score" && q.rubric && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-text-muted">Rubric Scale:</span>
                      {q.rubric.map((lvl) => (
                        <span
                          key={lvl}
                          className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        >
                          {lvl}
                        </span>
                      ))}
                    </div>
                  )}

                  {q.type === "noul" && (
                    <span className="text-[11px] font-mono text-purple-400">
                      Evaluates calibrated True / False boolean probability
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* TAB 2: JSON Code Editor */}
        {activeTab === "json" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Declarative Laya rulebook format. Validates in real time.</span>
              {jsonError ? (
                <span className="text-red-400 font-mono font-semibold">{jsonError}</span>
              ) : (
                <span className="text-primary font-mono flex items-center gap-1">
                  <Check className="h-3 w-3" /> Valid JSON
                </span>
              )}
            </div>

            <textarea
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                try {
                  JSON.parse(e.target.value);
                  setJsonError(null);
                } catch (err) {
                  setJsonError(err instanceof Error ? err.message : "Invalid JSON");
                }
              }}
              rows={18}
              className="w-full font-mono text-xs p-4 rounded-xl bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-y leading-relaxed"
              spellCheck={false}
            />
          </div>
        )}

        {/* TAB 3: Checkpoints & Rollback History */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {checkpoints.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-text-muted bg-bg-surface rounded-xl border border-border">
                No checkpoints found.
              </div>
            ) : (
              checkpoints.map((cp) => {
                const isActive = cp.id === settings.active_checkpoint;
                return (
                  <div
                    key={cp.id}
                    className={cn(
                      "p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-border bg-bg-surface hover:border-border/80",
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-text-primary">
                          {cp.id}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                            ACTIVE
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-text-muted">
                          by <span className="text-text-primary font-medium">{cp.author}</span>
                        </span>
                        <span className="text-[11px] font-mono text-text-muted/60">
                          {new Date(cp.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">
                        {cp.description || "No description provided"}
                      </p>
                      <div className="text-[11px] font-mono text-text-muted/80">
                        {Object.keys(cp.questions || {}).length} rules defined (
                        {Object.keys(cp.questions || {}).join(", ")})
                      </div>
                    </div>

                    {!isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRollbackTargetId(cp.id)}
                        className="h-8 text-xs font-medium gap-1.5 border-border hover:border-primary text-text-primary"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Rollback to This
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 4: Test Playground */}
        {activeTab === "test" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                  Input State (Log Line / Query)
                </label>
                <textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  rows={4}
                  className="w-full text-xs font-mono p-3 rounded-xl bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-primary"
                  placeholder="Paste log line or user query here..."
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                    Evaluate Rule
                  </label>
                  <select
                    value={selectedQuestionName}
                    onChange={(e) => setSelectedQuestionName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl text-xs bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-primary cursor-pointer"
                  >
                    {questionsList.map((q) => (
                      <option key={q.name} value={q.name}>
                        {q.name} ({q.type})
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  onClick={handleRunTest}
                  disabled={isTesting}
                  className="w-full h-10 text-xs font-semibold gap-2 bg-primary text-black hover:bg-primary/90"
                >
                  <Play className="h-4 w-4" /> {isTesting ? "Evaluating..." : "Evaluate with Laya"}
                </Button>
              </div>
            </div>

            {/* Test Result Display */}
            {testResult && (
              <div className="p-5 rounded-xl border border-primary/40 bg-primary/5 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <span className="text-xs font-mono font-semibold text-text-primary">
                      Prediction Result
                    </span>
                  </div>
                  <span className="text-xs font-mono text-primary font-bold">
                    Confidence: {(testResult.confidence * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-text-muted">Selected Decision:</span>
                  <span className="text-base font-bold font-mono text-primary px-3 py-1 rounded-lg bg-primary/15 border border-primary/30">
                    {testResult.selected_label}
                  </span>
                  {testResult.question_type === "score" && (
                    <span className="text-xs font-mono text-text-muted">
                      (Expected score: {testResult.selected_score.toFixed(2)})
                    </span>
                  )}
                </div>

                {/* Probability Distribution Bar */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <span className="text-[11px] font-mono text-text-muted">
                    Calibrated Probability Distribution:
                  </span>
                  <div className="space-y-1.5">
                    {testResult.labels.map((lbl, idx) => {
                      const prob = testResult.probabilities[idx] || 0;
                      const pct = (prob * 100).toFixed(1);
                      const isTop = lbl === testResult.selected_label;
                      return (
                        <div key={lbl} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className={cn(isTop ? "text-primary font-bold" : "text-text-muted")}>
                              {lbl}
                            </span>
                            <span className="text-text-muted">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-bg-surface-active rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                isTop ? "bg-primary" : "bg-text-muted/40",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Add/Edit Rule */}
      <Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
        <DialogContent className="sm:max-w-[500px] bg-bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-text-primary">
              Add Decision Rule
            </DialogTitle>
            <DialogDescription className="text-xs text-text-muted">
              Define a typed question for Laya to answer in a single forward pass.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-text-muted">Rule Identifier</label>
              <input
                type="text"
                placeholder="e.g. subsystem_failure"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full h-9 px-3 rounded-lg text-xs bg-bg-app border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-text-muted">Decision Primitive Type</label>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as QuestionType)}
                className="w-full h-9 px-3 rounded-lg text-xs bg-bg-app border border-border text-text-primary focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="choice">Choice (Categorical classification)</option>
                <option value="score">Score (Ordinal rubric rating)</option>
                <option value="noul">Noul (Calibrated True/False)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-text-muted">Instruction Prompt</label>
              <textarea
                placeholder="e.g. Determine the primary subsystem responsible for this log event"
                value={ruleInstructions}
                onChange={(e) => setRuleInstructions(e.target.value)}
                rows={2}
                className="w-full p-2.5 rounded-lg text-xs bg-bg-app border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            {ruleType === "choice" && (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-text-muted">
                  Options (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="database, network, auth, disk_io, application"
                  value={ruleOptions}
                  onChange={(e) => setRuleOptions(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-xs bg-bg-app border border-border text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            )}

            {ruleType === "score" && (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-text-muted">
                  Rubric Scale Levels (comma-separated integers)
                </label>
                <input
                  type="text"
                  placeholder="1, 2, 3, 4, 5"
                  value={ruleRubric}
                  onChange={(e) => setRuleRubric(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-xs bg-bg-app border border-border text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddRuleOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveVisualRule}
              className="text-xs bg-primary text-black hover:bg-primary/90"
            >
              Save Rule Checkpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Commit JSON Checkpoint */}
      <Dialog open={isSaveCheckpointOpen} onOpenChange={setIsSaveCheckpointOpen}>
        <DialogContent className="sm:max-w-[450px] bg-bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-text-primary">
              Commit Rule Checkpoint
            </DialogTitle>
            <DialogDescription className="text-xs text-text-muted">
              Creates a versioned snapshot of the current rules with rollback support.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-mono text-text-muted">Author</label>
              <input
                type="text"
                value={checkpointAuthor}
                onChange={(e) => setCheckpointAuthor(e.target.value)}
                className="w-full h-9 px-3 rounded-lg text-xs bg-bg-app border border-border text-text-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-text-muted">Change Description</label>
              <input
                type="text"
                placeholder="e.g. Refined auth deadlock categories"
                value={checkpointDesc}
                onChange={(e) => setCheckpointDesc(e.target.value)}
                className="w-full h-9 px-3 rounded-lg text-xs bg-bg-app border border-border text-text-primary"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSaveCheckpointOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveJsonRules}
              className="text-xs bg-primary text-black hover:bg-primary/90"
            >
              Commit & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Rollback Confirmation */}
      <Dialog open={Boolean(rollbackTargetId)} onOpenChange={() => setRollbackTargetId(null)}>
        <DialogContent className="sm:max-w-[400px] bg-bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-text-primary">
              Confirm Checkpoint Rollback
            </DialogTitle>
            <DialogDescription className="text-xs text-text-muted">
              Are you sure you want to revert active rules to checkpoint{" "}
              <span className="font-mono font-bold text-text-primary">{rollbackTargetId}</span>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRollbackTargetId(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmRollback}
              className="text-xs bg-primary text-black hover:bg-primary/90"
            >
              Confirm Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Laya Guide & Primitives Documentation */}
      <Dialog open={isGuideModalOpen} onOpenChange={setIsGuideModalOpen}>
        <DialogContent className="sm:max-w-[620px] bg-bg-surface border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Zap className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-semibold text-text-primary">
                Laya System 1 Architecture & Smart Tagging
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-text-muted">
              Learn how Laya classifies Drain3 cluster templates locally on CPU with zero cloud costs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs text-text-muted leading-relaxed">
            <div className="p-3.5 rounded-xl bg-bg-app border border-border space-y-2">
              <div className="flex items-center gap-2 text-text-primary font-semibold text-xs">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Primary Role: Background Smart Cluster Tagging
              </div>
              <p>
                Laya runs as a background worker on your local CPU. When the Drain3 pattern miner discovers or updates log template patterns, Laya evaluates the template in ~30ms and saves structured triage tags directly into DuckDB:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-text-muted font-mono text-[11px]">
                <li><strong className="text-text-primary">category</strong>: application, database, network, auth, disk_io, third_party</li>
                <li><strong className="text-text-primary">severity</strong>: 1.0 (trivial) to 5.0 (catastrophic)</li>
                <li><strong className="text-text-primary">is_outage</strong>: whether the pattern reflects customer-facing service downtime</li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <h4 className="font-semibold text-text-primary uppercase tracking-wider text-[11px] font-mono">
                The 3 Decision Primitives
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-blue-400">1. Choice</span>
                    <span className="text-[10px] font-mono uppercase bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">Categorical</span>
                  </div>
                  <p className="text-text-muted text-[11px]">
                    Selects exactly one label from a closed set of options (e.g. subsystem routing, error classification).
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-amber-400">2. Score</span>
                    <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">Ordinal Rubric</span>
                  </div>
                  <p className="text-text-muted text-[11px]">
                    Rates severity or confidence against an integer rubric scale (e.g. 1 to 5), computing an expected value.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-purple-400">3. Noul</span>
                    <span className="text-[10px] font-mono uppercase bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">Calibrated Boolean</span>
                  </div>
                  <p className="text-text-muted text-[11px]">
                    Produces a calibrated True / False probability (e.g. "Does this template represent an outage?").
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
                <Info className="h-3.5 w-3.5" />
                How the LLM Uses Laya Tags
              </div>
              <p className="text-text-muted text-[11px]">
                Chat queries go directly to your configured LLM (Claude, GPT-4o, Ollama, etc.). The LLM receives Laya's cluster triage tags in its grounded context and through the <code className="text-primary font-mono text-[10px]">get_clusters</code> tool, allowing it to instantly identify failing subsystems without extra API tokens.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              onClick={() => setIsGuideModalOpen(false)}
              className="text-xs bg-primary text-black hover:bg-primary/90"
            >
              Close Guide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
