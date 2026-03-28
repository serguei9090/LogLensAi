import { HelpTooltip } from "@/components/atoms/HelpTooltip";
import { cn } from "@/lib/utils";
import { Bot, Check, Cpu, Layers, Palette, Save } from "lucide-react";
import { useState } from "react";

export interface AppSettings {
  ai_provider: string;
  ai_api_key: string;
  ai_system_prompt: string;
  drain_similarity_threshold: number;
  drain_max_children: number;
  drain_max_clusters: number;
  ui_row_height: string;
  ui_font_size: string;
}

const defaultSettings: AppSettings = {
  ai_provider: "gemini-cli",
  ai_api_key: "",
  ai_system_prompt:
    "You are a Log Analysis Specialist. Return JSON with summary, root_cause, actions.",
  drain_similarity_threshold: 0.4,
  drain_max_children: 100,
  drain_max_clusters: 1000,
  ui_row_height: "default",
  ui_font_size: "13px",
};

type SectionId = "ai" | "drain" | "general";

const SECTIONS: { id: SectionId; icon: typeof Bot; label: string; desc: string }[] = [
  { id: "ai", icon: Bot, label: "AI Intelligence", desc: "Model & analyze logic" },
  { id: "drain", icon: Cpu, label: "Engine Core", desc: "Clustering parameters" },
  { id: "general", icon: Palette, label: "Interface", desc: "Display & accessibility" },
];

function SettingInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
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
  children,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
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

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

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
                    value={settings.ai_provider}
                    onChange={(v) => update("ai_provider", v)}
                  >
                    <option value="gemini-cli">Gemini CLI (Native Local)</option>
                    <option value="openai">OpenAI (SaaS)</option>
                    <option value="anthropic">Anthropic Claude (SaaS)</option>
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
    </div>
  );
}
