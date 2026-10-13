// Assume Role: Frontend Engineer (@frontend)

import { HardwareAcceleration } from "@/components/molecules/HardwareAcceleration";
import { ModelWeightsStatus } from "@/components/molecules/ModelWeightsStatus";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLayaStore } from "@/store/layaStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { QuestionType } from "@/types/laya";
import { Code2, History, Layers, Play, Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckpointsTab } from "./components/CheckpointsTab";
import { JsonEditorTab } from "./components/JsonEditorTab";
import { LayaHeaderBanner } from "./components/LayaHeaderBanner";
import { TestPlaygroundTab } from "./components/TestPlaygroundTab";
import { VisualRulesTab } from "./components/VisualRulesTab";
import { AddEditRuleModal } from "./modals/AddEditRuleModal";
import { LayaGuideModal } from "./modals/LayaGuideModal";
import { RollbackModal } from "./modals/RollbackModal";
import { SaveCheckpointModal } from "./modals/SaveCheckpointModal";

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
  const [editingRuleName, setEditingRuleName] = useState<string | null>(null);
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
      toast.success(
        checked ? "Laya System 1 Accelerator enabled" : "Laya System 1 Accelerator disabled",
      );
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

  const handleOpenAddRule = () => {
    setEditingRuleName(null);
    setRuleName("");
    setRuleType("choice");
    setRuleInstructions("");
    setRuleOptions("");
    setRuleRubric("1, 2, 3, 4, 5");
    setIsAddRuleOpen(true);
  };

  const handleOpenEditRule = (q: {
    name: string;
    type: QuestionType;
    instructions?: string;
    options?: string[];
    rubric?: number[];
  }) => {
    setEditingRuleName(q.name);
    setRuleName(q.name);
    setRuleType(q.type);
    setRuleInstructions(q.instructions || "");
    setRuleOptions(q.options?.join(", ") || "");
    setRuleRubric(q.rubric?.join(", ") || "1, 2, 3, 4, 5");
    setIsAddRuleOpen(true);
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

    if (editingRuleName && editingRuleName !== trimmedName) {
      delete updatedQuestions[editingRuleName];
    }

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
        editingRuleName ? `Updated rule: ${trimmedName}` : `Added rule: ${trimmedName}`,
        updatedQuestions,
        activeWorkspaceId,
      );
      setIsAddRuleOpen(false);
      setEditingRuleName(null);
      setRuleName("");
      setRuleInstructions("");
      setRuleOptions("");
      toast.success(
        editingRuleName
          ? `Rule "${trimmedName}" updated as new checkpoint`
          : `Rule "${trimmedName}" saved as new checkpoint`,
      );
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
    if (!rollbackTargetId) {
      return;
    }
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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Accelerator Switch */}
      <LayaHeaderBanner
        isEnabled={settings.enabled}
        onToggleEnabled={handleToggleEnabled}
        onOpenGuide={() => setIsGuideModalOpen(true)}
      />

      {/* Hardware Acceleration Mode (CPU Zero-VRAM vs GPU) */}
      <HardwareAcceleration currentDevice={settings.device} onDeviceChange={handleDeviceChange} />

      {/* Model Weights & Local Cache Status */}
      <ModelWeightsStatus
        modelStatus={modelStatus}
        isLoading={useLayaStore.getState().isLoading && modelStatus === null}
        onDownloadModel={handleDownloadModel}
      />

      {/* Tabs Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-bg-surface p-1 rounded-xl border border-border shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("visual")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0",
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
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0",
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
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0",
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
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0",
                activeTab === "test"
                  ? "bg-primary text-black font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-primary",
              )}
            >
              <Play className="h-3.5 w-3.5" /> Test Playground
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab === "visual" && (
              <Button
                size="sm"
                onClick={handleOpenAddRule}
                className="h-8 text-xs font-medium gap-1.5 bg-primary text-black hover:bg-primary/90 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" /> Add Rule
              </Button>
            )}
            {activeTab === "json" && (
              <Button
                size="sm"
                onClick={() => setIsSaveCheckpointOpen(true)}
                className="h-8 text-xs font-medium gap-1.5 bg-primary text-black hover:bg-primary/90 shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" /> Commit
              </Button>
            )}
          </div>
        </div>

        {/* TAB 1: Visual Rules Builder */}
        {activeTab === "visual" && (
          <VisualRulesTab
            questionsList={questionsList}
            onOpenAddRule={handleOpenAddRule}
            onOpenEditRule={handleOpenEditRule}
            onDeleteRule={handleDeleteRule}
          />
        )}

        {/* TAB 2: JSON Code Editor */}
        {activeTab === "json" && (
          <JsonEditorTab
            jsonText={jsonText}
            jsonError={jsonError}
            onJsonChange={(val) => {
              setJsonText(val);
              try {
                JSON.parse(val);
                setJsonError(null);
              } catch (err) {
                setJsonError(err instanceof Error ? err.message : "Invalid JSON");
              }
            }}
          />
        )}

        {/* TAB 3: Checkpoints & Rollback History */}
        {activeTab === "history" && (
          <CheckpointsTab
            checkpoints={checkpoints}
            activeCheckpointId={settings.active_checkpoint}
            onOpenRollback={(cpId) => setRollbackTargetId(cpId)}
          />
        )}

        {/* TAB 4: Test Playground */}
        {activeTab === "test" && (
          <TestPlaygroundTab
            testText={testText}
            selectedQuestionName={selectedQuestionName}
            isTesting={isTesting}
            testResult={testResult}
            questionsList={questionsList}
            onTestTextChange={setTestText}
            onQuestionNameChange={setSelectedQuestionName}
            onRunTest={handleRunTest}
          />
        )}
      </div>

      {/* Modals */}
      <AddEditRuleModal
        isOpen={isAddRuleOpen}
        editingRuleName={editingRuleName}
        ruleName={ruleName}
        ruleType={ruleType}
        ruleInstructions={ruleInstructions}
        ruleOptions={ruleOptions}
        ruleRubric={ruleRubric}
        onOpenChange={(open) => {
          setIsAddRuleOpen(open);
          if (!open) {
            setEditingRuleName(null);
          }
        }}
        onRuleNameChange={setRuleName}
        onRuleTypeChange={setRuleType}
        onRuleInstructionsChange={setRuleInstructions}
        onRuleOptionsChange={setRuleOptions}
        onRuleRubricChange={setRuleRubric}
        onSaveRule={handleSaveVisualRule}
      />

      <SaveCheckpointModal
        isOpen={isSaveCheckpointOpen}
        checkpointAuthor={checkpointAuthor}
        checkpointDesc={checkpointDesc}
        onOpenChange={setIsSaveCheckpointOpen}
        onAuthorChange={setCheckpointAuthor}
        onDescChange={setCheckpointDesc}
        onSaveRules={handleSaveJsonRules}
      />

      <RollbackModal
        rollbackTargetId={rollbackTargetId}
        onOpenChange={() => setRollbackTargetId(null)}
        onConfirmRollback={handleConfirmRollback}
      />

      <LayaGuideModal isOpen={isGuideModalOpen} onOpenChange={setIsGuideModalOpen} />
    </div>
  );
}
