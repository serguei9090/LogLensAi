import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import { useIngestionStore } from "@/store/ingestion";
import { useInvestigationStore } from "@/store/investigationStore";
import { type AppSettings, defaultSettings, useSettingsStore } from "@/store/settingsStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  BookOpen,
  Bot,
  Check,
  Cpu,
  FolderOpen,
  Loader2,
  Network,
  RefreshCcw,
  RotateCcw,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SectionLabel } from "./components/SectionLabel";
import { AISettingsSection } from "./sections/AISettingsSection";
import { DrainSettingsSection } from "./sections/DrainSettingsSection";
import { IngestionSettingsSection } from "./sections/IngestionSettingsSection";
import { LayaSettingsSection } from "./sections/LayaSettingsSection";
import { RAGSettingsSection } from "./sections/RAGSettingsSection";
import { parseRemote } from "./utils/settingsSerialization";

export type SectionId = "ai" | "rag" | "laya" | "drain" | "ingestion";

const SECTIONS: {
  id: SectionId;
  icon: typeof Bot;
  label: string;
  desc: string;
}[] = [
  { id: "ai", icon: Bot, label: "AI Intelligence", desc: "Model & analyze logic" },
  { id: "rag", icon: BookOpen, label: "Knowledge RAG", desc: "Runbooks & memories" },
  { id: "laya", icon: Zap, label: "Laya AI", desc: "Fast router & rules engine" },
  { id: "drain", icon: Cpu, label: "Engine Core", desc: "Clustering parameters" },
  { id: "ingestion", icon: Network, label: "Ingestion", desc: "Live stream listeners" },
];

export function SettingsPanel({ onSave }: { readonly onSave: (settings: AppSettings) => void }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [activeSection, setActiveSection] = useState<SectionId>("ai");
  const [saved, setSaved] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isResetPatternsModalOpen, setIsResetPatternsModalOpen] = useState(false);
  const [isFactoryResetModalOpen, setIsFactoryResetModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const { activeWorkspaceId, reset: resetWorkspaces } = useWorkspaceStore();
  const { clearState: clearIngestion } = useIngestionStore();
  const { reset: resetInvestigation } = useInvestigationStore();
  const {
    updateSettings,
    flushPendingSettings,
    verifiedProviders,
    markProviderVerified,
    providerModelsCache,
    setProviderCachedModels,
  } = useSettingsStore();

  const availableModels = providerModelsCache[settings.ai_provider] || [];

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K], immediate = true) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    if (immediate) {
      onSave(newSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleResetAll = async () => {
    try {
      await updateSettings(defaultSettings);
      toast.success("Settings reset to defaults successfully");
      globalThis.setTimeout(() => globalThis.location.reload(), 1000);
    } catch (error) {
      console.error("Failed to reset all settings:", error);
      toast.error("Failed to reset settings");
    }
  };

  const handleFactoryReset = async () => {
    try {
      setIsRestarting(true);
      setIsFactoryResetModalOpen(false);

      await callSidecar({ method: "factory_reset", params: {} });

      clearIngestion();
      resetWorkspaces();
      resetInvestigation();
      localStorage.clear();

      toast.success("Factory reset complete. Application will restart.");
      globalThis.setTimeout(() => globalThis.location.reload(), 1500);
    } catch (error) {
      console.error("Factory reset failed:", error);
      toast.error("Factory reset failed. Manual cleanup may be required.");
    }
  };

  const handleResetPatterns = async () => {
    try {
      await callSidecar({
        method: "reset_templates",
        params: {
          workspace_id: settings.drain_template_scope === "global" ? undefined : activeWorkspaceId,
        },
      });
      toast.success("Pattern cache cleared successfully");
      setIsResetPatternsModalOpen(false);
    } catch (error) {
      console.error("Failed to reset patterns:", error);
      toast.error("Failed to reset patterns");
    }
  };

  const handleResetMasks = () => {
    update("drain_masks", defaultSettings.drain_masks);
    toast.success("Variable masking reset to standard heuristics");
  };

  const fetchModels = useCallback(
    async (targetProvider?: string) => {
      const provider = targetProvider || settings.ai_provider;
      if (!provider) {
        return;
      }
      setIsFetchingModels(true);
      try {
        const models = await callSidecar<string[]>({
          method: "list_ai_models",
          params: {},
        });
        if (models && Array.isArray(models) && models.length > 0) {
          setProviderCachedModels(provider, models);
        }
      } catch (e) {
        console.error("Failed to fetch ai models:", e);
      } finally {
        setIsFetchingModels(false);
      }
    },
    [settings.ai_provider, setProviderCachedModels],
  );

  const handleTestConnection = async () => {
    onSave(settings);
    await flushPendingSettings();

    setIsTestingConnection(true);
    try {
      const res = await callSidecar<{ status: string; message: string }>({
        method: "test_ai_connection",
        params: {},
      });
      if (res.status === "success") {
        toast.success(res.message);
        markProviderVerified(settings.ai_provider);
        fetchModels();
      } else if (res.status === "warning") {
        toast.warning(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      console.error("Failed to test AI connection:", error);
      toast.error("Failed to test connection");
    } finally {
      setIsTestingConnection(false);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const remoteSettings = await callSidecar<Record<string, string>>({
          method: "get_settings",
          params: {},
        });
        if (remoteSettings) {
          setSettings((prev) => parseRemote(remoteSettings, prev));
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, []);

  return (
    <div className="flex h-full bg-bg-base overflow-hidden">
      {/* Sidebar Nav */}
      <aside className="w-64 shrink-0 border-r border-border bg-bg-surface/30 flex flex-col p-6">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-text-primary">Settings</h1>
          <p className="text-xs text-text-muted mt-1">Configure your log analysis environment</p>
        </div>

        <nav className="flex flex-col gap-1.5 flex-1">
          {SECTIONS.map(({ id, icon: Icon, label, desc }) => (
            <Button
              key={id}
              variant="ghost"
              onClick={() => setActiveSection(id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all relative group overflow-hidden h-auto w-full justify-start",
                activeSection === id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary border border-transparent",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-transform group-hover:scale-110",
                  activeSection === id
                    ? "text-primary"
                    : "text-text-muted group-hover:text-text-secondary",
                )}
              />
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs mt-0.5 opacity-60 leading-none">{desc}</p>
              </div>
              {activeSection === id && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-full" />
              )}
            </Button>
          ))}
        </nav>

        <div className="mt-auto pt-6 flex flex-col gap-4">
          <div
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-500",
              saved
                ? "text-primary bg-primary/5 border border-primary/20"
                : "text-text-muted opacity-40",
            )}
          >
            {saved ? (
              <>
                <Check className="h-3 w-3" />
                <span>Changes Auto-Saved</span>
              </>
            ) : (
              <>
                <RefreshCcw className="h-3 w-3 animate-spin-slow" />
                <span>Ready for Changes</span>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            onClick={() => setIsResetModalOpen(true)}
            className="flex items-center gap-2 px-4 py-3 text-text-muted hover:text-amber-400 hover:bg-amber-500/5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all border border-transparent hover:border-amber-500/10 group h-auto w-full justify-start"
          >
            <RotateCcw className="size-4 shrink-0 opacity-50 group-hover:opacity-100" />
            Reset Settings
          </Button>

          <Button
            variant="ghost"
            onClick={() => setIsFactoryResetModalOpen(true)}
            className="flex items-center gap-2 px-4 py-3 text-text-muted hover:text-red-400 hover:bg-red-500/5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all border border-transparent hover:border-red-500/10 group h-auto w-full justify-start"
          >
            <Trash2 className="size-4 shrink-0 opacity-50 group-hover:opacity-100" />
            Factory Reset
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-bg-base/50 relative">
        <div className="max-w-3xl mx-auto px-12 py-12 space-y-12">
          {activeSection === "ai" && (
            <AISettingsSection
              settings={settings}
              setSettings={setSettings}
              update={update}
              onSave={onSave}
              setSaved={setSaved}
              verifiedProviders={verifiedProviders}
              providerModelsCache={providerModelsCache}
              availableModels={availableModels}
              isFetchingModels={isFetchingModels}
              isTestingConnection={isTestingConnection}
              handleTestConnection={handleTestConnection}
              fetchModels={fetchModels}
              setIsSkillModalOpen={setIsSkillModalOpen}
            />
          )}

          {activeSection === "rag" && (
            <RAGSettingsSection settings={settings} update={update} onSave={onSave} />
          )}

          {activeSection === "drain" && (
            <DrainSettingsSection
              settings={settings}
              update={update}
              onSave={onSave}
              handleResetMasks={handleResetMasks}
              setIsResetPatternsModalOpen={setIsResetPatternsModalOpen}
            />
          )}

          {activeSection === "ingestion" && (
            <IngestionSettingsSection settings={settings} update={update} onSave={onSave} />
          )}

          {activeSection === "laya" && <LayaSettingsSection />}
        </div>
      </main>

      {/* Add Skill Modal overlay */}
      {isSkillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderOpen className="size-4 text-primary" />
                Add Custom AI Skill
              </h3>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsSkillModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-md transition-colors text-text-muted hover:text-white"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                  <p className="text-xs text-primary/90 leading-relaxed font-medium">
                    Skills allow you to create custom AI capabilities using the{" "}
                    <code>.agents/skills/</code> architecture. Upload a valid skill folder
                    containing a <code>SKILL.md</code>.
                  </p>
                </div>

                <div className="space-y-3">
                  <SectionLabel>Skill Name</SectionLabel>
                  <input
                    placeholder="e.g. log-summarizer"
                    className="w-full px-4 py-2.5 rounded-xl text-xs bg-bg-surface border border-border text-text-primary placeholder:text-text-muted/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  />

                  <SectionLabel>Upload Skill Directory</SectionLabel>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border/60 rounded-xl hover:bg-white/[0.02] hover:border-primary/50 transition-colors cursor-pointer group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FolderOpen className="size-8 text-text-muted group-hover:text-primary transition-colors mb-2" />
                      <p className="text-xs text-text-secondary group-hover:text-text-primary font-medium">
                        Click to select skill folder
                      </p>
                      <p className="text-xs text-text-muted mt-1">Must contain a SKILL.md file</p>
                    </div>
                    {/* @ts-ignore */}
                    <input type="file" webkitdirectory="true" className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/5 bg-white/[0.01] flex justify-end gap-3 shrink-0">
              <Button
                variant="ghost"
                onClick={() => setIsSkillModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-white transition-colors h-auto"
              >
                Cancel
              </Button>
              <Button className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors shadow-lg active:scale-95 h-auto">
                Install Skill
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-bg-base border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-500">
              Reset All Settings?
            </DialogTitle>
            <DialogDescription className="text-zinc-400 pt-2">
              This will revert ALL global settings including AI Provider, Engine Parameters, and
              Network Ingestion to their factory defaults.
              <br />
              <br />
              <span className="text-red-400 font-bold uppercase text-xs">
                Warning: This action cannot be undone and the application will reload.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-zinc-300"
              onClick={() => setIsResetModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white border-none"
              onClick={handleResetAll}
            >
              Reset Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pattern Reset Confirmation Modal */}
      <Dialog open={isResetPatternsModalOpen} onOpenChange={setIsResetPatternsModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-bg-base border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-500">
              Clear Pattern Memory?
            </DialogTitle>
            <DialogDescription className="text-zinc-400 pt-2">
              This will force the engine to re-learn log templates from scratch.
              <br />
              <b>Note:</b> This will reset Cluster IDs in the log table, but your Masking Rules and
              Settings will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-zinc-300"
              onClick={() => setIsResetPatternsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white border-none"
              onClick={handleResetPatterns}
            >
              Clear Patterns
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Factory Reset Confirmation Modal */}
      <Dialog open={isFactoryResetModalOpen} onOpenChange={setIsFactoryResetModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-bg-base border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-500">
              Total Factory Reset?
            </DialogTitle>
            <div className="text-sm text-zinc-400 pt-2">
              This is a <span className="text-red-400 font-bold underline">Nuclear Option</span>.
              <br />
              <br />
              It will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                <li>All Workspace and Source definitions</li>
                <li>All Log databases and Pattern caches</li>
                <li>All AI Chat History and Learned Memory</li>
                <li>All Global and Workspace Settings</li>
              </ul>
              <br />
              <span className="text-red-400 font-bold uppercase text-xs">
                Warning: This action is irreversible. The app will be wiped and reloaded.
              </span>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-zinc-300"
              onClick={() => setIsFactoryResetModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white border-none"
              onClick={handleFactoryReset}
            >
              Wipe Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restarting Overlay */}
      {isRestarting && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm pointer-events-auto">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h2 className="text-2xl font-bold text-foreground">Initializing System...</h2>
          <p className="text-sm text-zinc-400 mt-2">
            Please wait while the environment is prepared.
          </p>
        </div>
      )}
    </div>
  );
}
