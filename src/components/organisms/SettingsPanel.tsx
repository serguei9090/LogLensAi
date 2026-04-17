import { HelpTooltip } from "@/components/atoms/HelpTooltip";
import { Switch } from "@/components/ui/switch";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  Bot,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Cpu,
  FolderOpen,
  Globe,
  Layers,
  Palette,
  Plus,
  RefreshCcw,
  Save,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { type AppSettings, defaultSettings } from "@/store/settingsStore";

type SectionId = "ai" | "drain" | "general";

const SECTIONS: { id: SectionId; icon: typeof Bot; label: string; desc: string }[] = [
  { id: "ai", icon: Bot, label: "AI Intelligence", desc: "Model & analyze logic" },
  { id: "drain", icon: Cpu, label: "Engine Core", desc: "Clustering parameters" },
  { id: "general", icon: Palette, label: "Interface", desc: "Display & accessibility" },
];

function SettingInput(props: Readonly<React.InputHTMLAttributes<HTMLInputElement>>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full h-10 px-4 rounded-xl text-sm bg-bg-surface border border-border text-text-primary placeholder:text-text-muted/30",
        "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all",
        props.className,
      )}
    />
  );
}

function SettingSelect({
  value,
  onChange,
  id,
  children,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly id?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-4 rounded-xl text-sm bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
      >
        {children}
      </select>
      <div className="absolute right-3 top-1/2 -translateY-1/2 pointer-events-none opacity-40">
        <Check className="h-3 w-3 rotate-90" />
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  htmlFor,
}: { readonly children: React.ReactNode; readonly htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2 ml-1"
    >
      {children}
    </label>
  );
}
export function SettingsPanel({ onSave }: { readonly onSave: (settings: AppSettings) => void }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [activeSection, setActiveSection] = useState<SectionId>("ai");
  const [saved, setSaved] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([
    "gemma4:e2b",
    "llama3",
    "mistral",
  ]);

  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const { activeWorkspaceId } = useWorkspaceStore();

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const handleResetTemplates = async () => {
    try {
      await callSidecar({
        method: "reset_drain_templates",
        params: { workspace_id: activeWorkspaceId },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to reset templates:", error);
    }
  };

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const remoteSettings = (await callSidecar({
          method: "get_settings",
          params: {},
        })) as Record<string, string>;
        if (remoteSettings) {
          setSettings((prev) => ({
            ...prev,
            ...remoteSettings,
            // Cast numeric/boolean strings back to proper types
            drain_similarity_threshold: Number.parseFloat(
              remoteSettings.drain_similarity_threshold || "0.4",
            ),
            drain_max_children: Number.parseInt(remoteSettings.drain_max_children || "100", 10),
            drain_max_clusters: Number.parseInt(remoteSettings.drain_max_clusters || "1000", 10),
            mcp_server_enabled: remoteSettings.mcp_server_enabled === "true",
            ai_tool_search: remoteSettings.ai_tool_search !== "false",
            ai_tool_memory: remoteSettings.ai_tool_memory !== "false",
          }));
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const models = await callSidecar<string[]>({ method: "list_ai_models", params: {} });
        if (models && models.length > 0) {
          setAvailableModels(models);
        }
      } catch (e) {
        console.error("Failed to fetch ai models:", e);
      }
    };
    if (settings.ai_provider === "ollama") {
      fetchModels();
    }
  }, [settings.ai_provider]);

  const handleSave = () => {
    onSave(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={cn(
                "flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-all relative group overflow-hidden",
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
                <p className="text-[13px] font-semibold">{label}</p>
                <p className="text-[10px] mt-0.5 opacity-60 leading-none">{desc}</p>
              </div>
              {activeSection === id && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={handleSave}
          className={cn(
            "mt-6 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all transform active:scale-95",
            saved
              ? "bg-zinc-800 text-primary border border-primary/30"
              : "bg-primary hover:bg-primary-hover text-bg-base shadow-xl shadow-primary/20",
          )}
        >
          {saved ? (
            <>
              <Check className="h-5 w-5 animate-in zoom-in duration-200" />
              <span>Saved Successfully</span>
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              <span>Apply Changes</span>
            </>
          )}
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-bg-base/50 relative">
        <div className="max-w-3xl mx-auto px-12 py-12 space-y-12">
          {/* AI Intelligence Section */}
          {activeSection === "ai" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="border-b border-border pb-6">
                <h2 className="text-2xl font-bold text-text-primary">AI Intelligence</h2>
                <p className="text-sm text-text-muted mt-2">
                  Fine-tune the reasoning engine used to summarize and root-cause log clusters.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <SectionLabel htmlFor="ai_provider">Model Provider</SectionLabel>
                  <SettingSelect
                    id="ai_provider"
                    value={settings.ai_provider}
                    onChange={(v) => {
                      update("ai_provider", v);
                      if (v === "ollama") {
                        update("ai_model", "gemma4:e2b");
                      } else if (v === "gemini-cli") {
                        update("ai_model", "flash");
                      }
                    }}
                  >
                    <option value="gemini-cli">Gemini CLI (Native Local)</option>
                    <option value="ollama">Ollama (Local Llama/Mistral)</option>
                    <option value="ai-studio">Gemini AI Studio (Free Tier)</option>
                    <option value="openai">OpenAI (Waitlist/Future)</option>
                  </SettingSelect>
                </div>
                <div className="space-y-2">
                  <SectionLabel htmlFor="ai_api_key">Secret API Key</SectionLabel>
                  <SettingInput
                    id="ai_api_key"
                    type="password"
                    value={settings.ai_api_key}
                    onChange={(e) => update("ai_api_key", e.target.value)}
                    placeholder="Encrypted: sk-••••••••••••••••"
                  />
                  <p className="text-[10px] text-text-muted/50 px-1">
                    Keys are stored securely in your local configuration.
                  </p>
                </div>
              </div>

              {settings.ai_provider === "gemini-cli" && (
                <div className="grid grid-cols-2 gap-8 pt-4 border-t border-border/30 animate-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <SectionLabel htmlFor="ai_model">Gemini Model Strategy</SectionLabel>
                    <SettingSelect
                      id="ai_model"
                      value={settings.ai_model}
                      onChange={(v) => update("ai_model", v)}
                    >
                      <option value="flash">Flash (Default - Fast)</option>
                      <option value="pro">Pro (Complex Logic)</option>
                      <option value="flash-lite">Flash Lite (Ultra Light)</option>
                      <option value="auto">Auto (Best Match)</option>
                      <option value="auto-gemini-3">Auto Gemini 3</option>
                      <option value="auto-gemini-2.5">Auto Gemini 2.5</option>
                    </SettingSelect>
                    <p className="text-[10px] text-text-muted/50 px-1">
                      Choose 'Flash' for speed or 'Pro' for deeper analysis.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <SectionLabel htmlFor="ai_gemini_url">A2A Server URL</SectionLabel>
                    <SettingInput
                      id="ai_gemini_url"
                      type="url"
                      value={settings.ai_gemini_url}
                      onChange={(e) => update("ai_gemini_url", e.target.value)}
                      placeholder="http://localhost:22436"
                    />
                    <p className="text-[10px] text-text-muted/50 px-1">Daemon port for Hot Mode.</p>
                  </div>
                </div>
              )}

              {settings.ai_provider === "ollama" && (
                <div className="grid grid-cols-2 gap-8 pt-4 border-t border-border/30 animate-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <SectionLabel htmlFor="ai_model">Ollama Model</SectionLabel>
                    <SettingSelect
                      id="ai_model_ollama"
                      value={settings.ai_model}
                      onChange={(v) => update("ai_model", v)}
                    >
                      {availableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </SettingSelect>
                    <p className="text-[10px] text-text-muted/50 px-1">
                      Available models are fetched dynamically.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <SectionLabel htmlFor="ai_ollama_host">Ollama Server Host</SectionLabel>
                    <SettingInput
                      id="ai_ollama_host"
                      type="url"
                      value={settings.ai_ollama_host}
                      onChange={(e) => update("ai_ollama_host", e.target.value)}
                      placeholder="http://localhost:11434"
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
                    <div className="bg-primary/20 p-2 rounded-lg">
                      <Cpu className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-primary uppercase tracking-wider">
                        Local Inference
                      </p>
                      <p className="text-[10px] text-text-muted">
                        Ensure Ollama is running and model (e.g. gemma4:e2b) is pulled.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <SectionLabel htmlFor="ai_system_prompt">Dynamic System Prompt</SectionLabel>
                  <HelpTooltip content="Defines the persona and constraints for the AI specialist." />
                </div>
                <textarea
                  id="ai_system_prompt"
                  value={settings.ai_system_prompt}
                  onChange={(e) => update("ai_system_prompt", e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 rounded-2xl text-xs font-mono bg-bg-surface border border-border text-text-primary placeholder:text-text-muted/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none transition-all"
                />
              </div>

              <div className="pt-4 border-t border-border/30">
                <button
                  type="button"
                  onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                  className="w-full flex items-center justify-between py-2 text-left group"
                >
                  <SectionLabel>Tools & Skills</SectionLabel>
                  <div className="text-text-muted group-hover:text-text-primary transition-colors pr-2">
                    {isToolsExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </div>
                </button>

                {isToolsExpanded && (
                  <div className="mt-3 space-y-4 px-1">
                    <div className="flex items-center justify-between bg-bg-surface/50 border border-border rounded-xl p-4 hover:bg-bg-surface transition-colors">
                      <div>
                        <p className="text-sm font-bold text-text-primary">
                          Enable Log Search Tool
                        </p>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          Allow AI to autonomously search the DuckDB storage for error contexts.
                        </p>
                      </div>
                      <Switch
                        checked={settings.ai_tool_search}
                        onCheckedChange={(checked) => update("ai_tool_search", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between bg-bg-surface/50 border border-border rounded-xl p-4 hover:bg-bg-surface transition-colors">
                      <div>
                        <p className="text-sm font-bold text-text-primary">
                          Enable Associative Memory
                        </p>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          Allow AI to save and autonomously retrieve past issue resolutions.
                        </p>
                      </div>
                      <Switch
                        checked={settings.ai_tool_memory}
                        onCheckedChange={(checked) => update("ai_tool_memory", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <p className="text-sm font-bold text-text-primary pl-2">Custom Skills</p>
                      <button
                        type="button"
                        onClick={() => setIsSkillModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Plus className="size-3" />
                        Add Skill
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {settings.ai_provider === "gemini-cli" && (
                <div className="flex items-start gap-4 bg-primary/5 border border-primary/20 rounded-2xl p-5 group hover:bg-primary/10 transition-colors">
                  <div className="bg-primary/20 p-2 rounded-xl">
                    <Layers className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">Gemini CLI Integrated</p>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                      Runs purely on your local hardware via the configured gemini-cli. Zero data
                      egress to third-party APIs beyond the model provider.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between bg-bg-surface/50 border border-border rounded-2xl p-5 hover:bg-bg-surface transition-colors">
                <div className="flex items-center gap-4">
                  <div className="bg-violet-500/10 p-2 rounded-xl">
                    <Terminal className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-primary">Agentic MCP Server</p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Expose log analysis tools via SSE (Port 5001) for external AI agents.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.mcp_server_enabled}
                  onCheckedChange={(checked) => update("mcp_server_enabled", checked)}
                />
              </div>
            </div>
          )}

          {/* Engine Core Section */}
          {activeSection === "drain" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="border-b border-border pb-6">
                <h2 className="text-2xl font-bold text-text-primary">Engine Core</h2>
                <p className="text-sm text-text-muted mt-2">
                  Adjust the Drain3 streaming parser to perfectly match your log formats.
                </p>
              </div>

              <div className="space-y-4">
                <SectionLabel>Template Isolation Scope</SectionLabel>
                <div className="flex p-1 bg-bg-surface border border-border rounded-xl w-fit">
                  {[
                    { id: "global", label: "Global", icon: Globe, desc: "Shared cross-workspace" },
                    {
                      id: "workspace",
                      label: "Workspace",
                      icon: Box,
                      desc: "Project-isolated",
                    },
                  ].map((scope) => (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() =>
                        update("drain_template_scope", scope.id as "global" | "workspace")
                      }
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                        settings.drain_template_scope === scope.id
                          ? "bg-primary text-bg-base shadow-lg"
                          : "text-text-muted hover:text-text-primary hover:bg-white/5",
                      )}
                    >
                      <scope.icon className="size-3.5" />
                      {scope.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-text-muted px-1">
                  Workspace scope ensures patterns found in one project don't pollute clustering
                  logic in others.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-8">
                <div className="space-y-2">
                  <SectionLabel htmlFor="drain_sim">Similarity</SectionLabel>
                  <SettingInput
                    id="drain_sim"
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={settings.drain_similarity_threshold}
                    onChange={(e) =>
                      update("drain_similarity_threshold", Number.parseFloat(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <SectionLabel htmlFor="drain_children">Branches</SectionLabel>
                  <SettingInput
                    id="drain_children"
                    type="number"
                    min="1"
                    value={settings.drain_max_children}
                    onChange={(e) =>
                      update("drain_max_children", Number.parseInt(e.target.value, 10))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <SectionLabel htmlFor="drain_clusters">Cluster Cap</SectionLabel>
                  <SettingInput
                    id="drain_clusters"
                    type="number"
                    min="1"
                    value={settings.drain_max_clusters}
                    onChange={(e) =>
                      update("drain_max_clusters", Number.parseInt(e.target.value, 10))
                    }
                  />
                </div>
              </div>

              <div className="bg-bg-surface/50 border border-border rounded-2xl p-6">
                <div className="flex justify-between text-xs font-bold text-text-muted mb-4 uppercase tracking-tighter">
                  <span>Permissive</span>
                  <span className="text-primary text-sm">
                    {settings.drain_similarity_threshold * 100}% Sensitivity
                  </span>
                  <span>Strict</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.drain_similarity_threshold}
                  onChange={(e) =>
                    update("drain_similarity_threshold", Number.parseFloat(e.target.value))
                  }
                  className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="text-[10px] text-text-muted/60 mt-4 leading-relaxed">
                  The similarity threshold determines how 'close' two log lines must be to share a
                  template. Lower values (0.1–0.4) are better for high-variance logs.
                </p>
              </div>

              <div className="space-y-4">
                <SectionLabel>Variable Masking</SectionLabel>
                <div className="space-y-2">
                  <p className="text-[10px] text-text-muted px-1 -mt-2">
                    Sanitize logs by replacing dynamic variables (IPs, IDs) with tokens before
                    clustering.
                  </p>
                  {settings.drain_masks.map((mask, idx) => (
                    <div
                      key={`${mask.label}-${idx}`}
                      className="flex items-center gap-3 bg-bg-surface/30 p-2 rounded-xl border border-border group animate-in slide-in-from-left-2 duration-200"
                    >
                      <div className="px-2">
                        <Switch
                          checked={mask.enabled}
                          onCheckedChange={(val) => {
                            const newMasks = [...settings.drain_masks];
                            newMasks[idx].enabled = val;
                            update("drain_masks", newMasks);
                          }}
                          className="scale-75"
                        />
                      </div>
                      <div className="flex-1 grid grid-cols-12 gap-2">
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={mask.label}
                            onChange={(e) => {
                              const newMasks = [...settings.drain_masks];
                              newMasks[idx].label = e.target.value;
                              update("drain_masks", newMasks);
                            }}
                            className="w-full bg-transparent border-none text-[11px] font-bold text-primary focus:ring-0 px-0 h-6 uppercase"
                            placeholder="LABEL"
                          />
                        </div>
                        <div className="col-span-9">
                          <input
                            type="text"
                            value={mask.pattern}
                            onChange={(e) => {
                              const newMasks = [...settings.drain_masks];
                              newMasks[idx].pattern = e.target.value;
                              update("drain_masks", newMasks);
                            }}
                            className="w-full bg-transparent border-none text-[11px] text-text-primary font-mono focus:ring-0 px-0 h-6"
                            placeholder="Regex Pattern"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newMasks = settings.drain_masks.filter((_, i) => i !== idx);
                          update("drain_masks", newMasks);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-red-400 transition-all cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      update("drain_masks", [
                        ...settings.drain_masks,
                        { label: "NEW_MASK", pattern: "", enabled: true },
                      ]);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-xl text-[10px] font-bold text-text-muted hover:border-primary hover:text-primary hover:bg-primary/5 transition-all uppercase tracking-tighter cursor-pointer"
                  >
                    <Plus className="size-3" />
                    Add Custom Masking Instruction
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-border/30 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-text-primary">Clustering Memory</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Resetting templates will force the parser to re-learn patterns from scratch.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetTemplates}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-bold transition-all border border-red-500/20"
                >
                  <RefreshCcw className="size-3.5" />
                  Reset {settings.drain_template_scope === "global" ? "Global" : "Workspace"}{" "}
                  Templates
                </button>
              </div>
            </div>
          )}

          {/* Interface Section */}
          {activeSection === "general" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="border-b border-border pb-6">
                <h2 className="text-2xl font-bold text-text-primary">Interface</h2>
                <p className="text-sm text-text-muted mt-2">
                  Accessibility and display preferences for your workspace.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <SectionLabel htmlFor="ui_row_height">Row Density</SectionLabel>
                  <SettingSelect
                    id="ui_row_height"
                    value={settings.ui_row_height}
                    onChange={(v) => update("ui_row_height", v)}
                  >
                    <option value="compact">Ultra Compact</option>
                    <option value="default">Balanced (Default)</option>
                    <option value="comfortable">Comfortable</option>
                  </SettingSelect>
                </div>
                <div className="space-y-2">
                  <SectionLabel htmlFor="ui_font_size">Reading Size</SectionLabel>
                  <SettingSelect
                    id="ui_font_size"
                    value={settings.ui_font_size}
                    onChange={(v) => update("ui_font_size", v)}
                  >
                    <option value="12px">12px — Minimal</option>
                    <option value="13px">13px — Optimized</option>
                    <option value="14px">14px</option>
                    <option value="16px">16px — Enhanced</option>
                  </SettingSelect>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-bg-surface/50 to-bg-base p-1">
                <div className="absolute inset-0 bg-primary/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative px-6 py-5">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-text-muted/50 mb-3">
                    Live Typography Preview
                  </p>
                  <div
                    className="font-mono leading-relaxed px-4 py-3 bg-bg-base/80 rounded-xl border border-border/40 shadow-inner"
                    style={{ fontSize: settings.ui_font_size }}
                  >
                    <span className="text-text-muted/60">Mar 27 16:45:01 </span>
                    <span className="text-error/80 font-bold tracking-tight px-1.5 rounded bg-error/10 mr-2">
                      CRITICAL
                    </span>
                    <span className="text-text-primary">
                      Worker[4] lost quorum connectivity to peer-93. Re-electing...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add Skill Modal overlay */}
      {isSkillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121413] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderOpen className="size-4 text-primary" />
                Add Custom AI Skill
              </h3>
              <button
                type="button"
                onClick={() => setIsSkillModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-md transition-colors text-text-muted hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                  <p className="text-[11px] text-primary/90 leading-relaxed font-medium">
                    Skills allow you to create custom AI capabilities (like scripts or prompt
                    injections) using the Antigravity <code>.agents/skills/</code> architecture.
                    Upload a valid skill folder containing a <code>SKILL.md</code>.
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
                      <p className="text-[10px] text-text-muted mt-1">
                        Must contain a SKILL.md file
                      </p>
                    </div>
                    {/* @ts-ignore */}
                    <input type="file" webkitdirectory="true" directory="true" className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/5 bg-white/[0.01] flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsSkillModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors shadow-lg active:scale-95"
              >
                Install Skill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
