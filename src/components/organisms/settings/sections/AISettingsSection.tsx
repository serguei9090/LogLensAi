import { HelpTooltip } from "@/components/atoms/HelpTooltip";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AppSettings } from "@/store/settingsStore";
import { Bot, ChevronDown, ChevronRight, Eye, EyeOff, Plus, Terminal } from "lucide-react";
import { useState } from "react";
import { ModelSelector } from "../components/ModelSelector";
import { SectionLabel } from "../components/SectionLabel";
import { SettingInput } from "../components/SettingInput";
import { SettingSelect } from "../components/SettingSelect";
import { getProviderDescription, getProviderLabel } from "../utils/providerMetadata";

interface AISettingsSectionProps {
  readonly settings: AppSettings;
  readonly setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  readonly update: <K extends keyof AppSettings>(
    key: K,
    val: AppSettings[K],
    saveImmediately?: boolean,
  ) => void;
  readonly onSave: (settings: AppSettings) => void;
  readonly setSaved: (saved: boolean) => void;
  readonly verifiedProviders: string[];
  readonly providerModelsCache: Record<string, string[]>;
  readonly availableModels: string[];
  readonly isFetchingModels: boolean;
  readonly isTestingConnection: boolean;
  readonly handleTestConnection: () => void;
  readonly fetchModels: (targetProvider?: string) => void;
  readonly setIsSkillModalOpen: (open: boolean) => void;
}

export function AISettingsSection({
  settings,
  setSettings,
  update,
  onSave,
  setSaved,
  verifiedProviders,
  providerModelsCache,
  availableModels,
  isFetchingModels,
  isTestingConnection,
  handleTestConnection,
  fetchModels,
  setIsSkillModalOpen,
}: AISettingsSectionProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);

  return (
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
            showCheckForOption={(optVal) => verifiedProviders.includes(optVal)}
            onChange={(v) => {
              let newModel = "";
              const cached = providerModelsCache[v];
              if (cached && cached.length > 0) {
                newModel = cached[0];
              }

              const updated = { ...settings, ai_provider: v, ai_model: newModel };
              setSettings(updated);
              onSave(updated);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
          >
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI (Official)</option>
            <option value="openrouter">OpenRouter</option>
            <option value="lmstudio">LM Studio</option>
            <option value="ai-studio">Gemini AI Studio</option>
            <option value="openai-compatible">OpenAI Compatible</option>
          </SettingSelect>
        </div>

        {settings.ai_provider === "ollama" && (
          <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="flex items-center justify-between">
              <SectionLabel htmlFor="ai_ollama_host">Ollama Server Host</SectionLabel>
              <Button
                variant="ghost"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="text-xs uppercase tracking-wider font-bold text-primary hover:text-primary-light transition-colors disabled:opacity-30 h-auto p-0"
              >
                {isTestingConnection ? "Testing..." : "Test Connection"}
              </Button>
            </div>
            <SettingInput
              id="ai_ollama_host"
              type="url"
              value={settings.ai_ollama_host}
              onChange={(e) => update("ai_ollama_host", e.target.value, false)}
              onBlur={() => onSave(settings)}
              placeholder="http://localhost:11434"
            />
            <p className="text-xs text-text-muted/60 px-1">Local Ollama instance URL.</p>
          </div>
        )}

        {settings.ai_provider === "lmstudio" && (
          <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="flex items-center justify-between">
              <SectionLabel htmlFor="ai_lmstudio_host">LM Studio Server Host</SectionLabel>
              <Button
                variant="ghost"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="text-xs uppercase tracking-wider font-bold text-primary hover:text-primary-light transition-colors disabled:opacity-30 h-auto p-0"
              >
                {isTestingConnection ? "Testing..." : "Test Connection"}
              </Button>
            </div>
            <SettingInput
              id="ai_lmstudio_host"
              type="url"
              value={settings.ai_lmstudio_host}
              onChange={(e) => update("ai_lmstudio_host", e.target.value, false)}
              onBlur={() => onSave(settings)}
              placeholder="http://localhost:1234/v1"
            />
            <p className="text-xs text-text-muted/60 px-1">
              Local LM Studio API URL (usually port 1234).
            </p>
          </div>
        )}

        {(settings.ai_provider === "openai" ||
          settings.ai_provider === "ai-studio" ||
          settings.ai_provider === "openai-compatible" ||
          settings.ai_provider === "openrouter") &&
          (() => {
            const keyField: keyof AppSettings =
              settings.ai_provider === "openai"
                ? "ai_openai_api_key"
                : settings.ai_provider === "ai-studio"
                  ? "ai_gemini_api_key"
                  : settings.ai_provider === "openrouter"
                    ? "ai_openrouter_api_key"
                    : "ai_openai_compat_api_key";
            const keyValue = (settings[keyField] as string | undefined) ?? "";
            const isKeyRequired = settings.ai_provider !== "openai-compatible";

            return (
              <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex items-center justify-between">
                  <SectionLabel htmlFor={keyField}>Secret API Key</SectionLabel>
                  <Button
                    variant="ghost"
                    onClick={handleTestConnection}
                    disabled={isTestingConnection || (isKeyRequired && !keyValue.trim())}
                    className="text-xs uppercase tracking-wider font-bold text-primary hover:text-primary-light transition-colors disabled:opacity-30 h-auto p-0"
                  >
                    {isTestingConnection ? "Testing..." : "Test Connection"}
                  </Button>
                </div>
                <div className="relative group/key">
                  <SettingInput
                    id={keyField}
                    type={showApiKey ? "text" : "password"}
                    value={keyValue}
                    onChange={(e) => update(keyField, e.target.value as any, false)}
                    onBlur={(e) => {
                      const latest = { ...settings, [keyField]: e.target.value };
                      onSave(latest);
                    }}
                    placeholder={
                      settings.ai_provider === "openrouter"
                        ? "sk-or-v1-••••••••••••••••"
                        : settings.ai_provider === "openai"
                          ? "sk-proj-••••••••••••••••"
                          : settings.ai_provider === "ai-studio"
                            ? "AIzaSy••••••••••••••••"
                            : "Optional: sk-••••••••••••••••"
                    }
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer select-none"
                    title={showApiKey ? "Hide API Key" : "Show API Key"}
                    aria-label={showApiKey ? "Hide API Key" : "Show API Key"}
                  >
                    {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="text-xs text-text-muted/50 px-1">
                  {settings.ai_provider === "openrouter"
                    ? "OpenRouter API Key. Stored securely in local DuckDB settings."
                    : settings.ai_provider === "openai"
                      ? "OpenAI API Key (sk-proj-...). Stored securely in local DuckDB settings."
                      : settings.ai_provider === "ai-studio"
                        ? "Google AI Studio Gemini API Key. Stored securely in local DuckDB settings."
                        : "API Key for your OpenAI-compatible gateway (optional for local proxies like LM Studio/vLLM)."}
                </p>
              </div>
            );
          })()}
      </div>

      {/* Model Selector Row */}
      <div className="grid grid-cols-2 gap-8 pt-4 border-t border-border/30">
        <ModelSelector
          value={settings.ai_model}
          onChange={(v) => update("ai_model", v)}
          availableModels={availableModels}
          isFetching={isFetchingModels}
          onRefresh={fetchModels}
          provider={settings.ai_provider}
          isVerified={verifiedProviders.includes(settings.ai_provider)}
          onTestConnection={handleTestConnection}
          isTestingConnection={isTestingConnection}
        />

        {settings.ai_provider === "openai-compatible" && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <SectionLabel htmlFor="ai_openai_host">API Base URL</SectionLabel>
            <SettingInput
              id="ai_openai_host"
              type="url"
              value={settings.ai_openai_host}
              onChange={(e) => update("ai_openai_host", e.target.value, false)}
              onBlur={() => onSave(settings)}
              placeholder="http://localhost:1234/v1 or https://api.groq.com/openai/v1"
            />
            <p className="text-xs text-text-muted/50 px-1">
              Protocol & host for the OpenAI-compatible endpoint (e.g., LM Studio, Groq, vLLM).
            </p>
          </div>
        )}

        {settings.ai_provider === "openrouter" && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <SectionLabel htmlFor="ai_openrouter_host">API Gateway URL</SectionLabel>
            <SettingInput
              id="ai_openrouter_host"
              type="url"
              value={settings.ai_openrouter_host}
              onChange={(e) => update("ai_openrouter_host", e.target.value, false)}
              onBlur={() => onSave(settings)}
              placeholder="https://openrouter.ai/api/v1"
            />
            <p className="text-xs text-text-muted/50 px-1">
              OpenRouter API gateway endpoint (default: https://openrouter.ai/api/v1).
            </p>
          </div>
        )}
      </div>

      {/* Status Banner */}
      <div className="col-span-2 flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
        <div className="bg-primary/20 p-2 rounded-lg">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-wider">
            {getProviderLabel(settings.ai_provider)}
          </p>
          <p className="text-xs text-text-muted">{getProviderDescription(settings.ai_provider)}</p>
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
          onChange={(e) => update("ai_system_prompt", e.target.value, false)}
          onBlur={() => onSave(settings)}
          rows={6}
          className="w-full px-4 py-3 rounded-2xl text-xs font-mono bg-bg-surface border border-border text-text-primary placeholder:text-text-muted/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none transition-all"
        />
      </div>

      {/* Tools & Skills */}
      <div className="pt-4 border-t border-border/30">
        <Button
          variant="ghost"
          onClick={() => setIsToolsExpanded(!isToolsExpanded)}
          className="w-full flex items-center justify-between py-2 text-left group h-auto px-0"
        >
          <SectionLabel>Tools & Skills</SectionLabel>
          <div className="text-text-muted group-hover:text-text-primary transition-colors pr-2">
            {isToolsExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </div>
        </Button>

        {isToolsExpanded && (
          <div className="mt-3 space-y-4 px-1">
            <div className="flex items-center justify-between bg-bg-surface/50 border border-border rounded-xl p-4 hover:bg-bg-surface transition-colors">
              <div>
                <p className="text-sm font-bold text-text-primary">Enable Log Search Tool</p>
                <p className="text-xs text-text-muted mt-0.5">
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
                <p className="text-sm font-bold text-text-primary">Enable Associative Memory</p>
                <p className="text-xs text-text-muted mt-0.5">
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
              <Button
                variant="ghost"
                onClick={() => setIsSkillModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-semibold transition-colors h-auto"
              >
                <Plus className="size-3" />
                Add Skill
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between bg-bg-surface/50 border border-border rounded-2xl p-5 hover:bg-bg-surface transition-colors">
        <div className="flex items-center gap-4">
          <div className="bg-violet-500/10 p-2 rounded-xl">
            <Terminal className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary">Agentic MCP Server</p>
            <p className="text-xs text-text-muted mt-0.5">
              Expose log analysis tools via SSE Port 5001 for external AI agents.
            </p>
          </div>
        </div>
        <Switch
          checked={settings.mcp_server_enabled}
          onCheckedChange={(checked) => update("mcp_server_enabled", checked)}
        />
      </div>
    </div>
  );
}
