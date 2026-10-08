import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, Sparkles } from "lucide-react";
import { OPENROUTER_FREE_MODELS } from "../utils/providerMetadata";
import { SectionLabel } from "./SectionLabel";
import { SettingInput } from "./SettingInput";
import { SettingSelect } from "./SettingSelect";

export function ModelSelector({
  value,
  onChange,
  availableModels,
  isFetching,
  onRefresh,
  provider,
  isVerified,
  onTestConnection,
  isTestingConnection,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly availableModels: string[];
  readonly isFetching: boolean;
  readonly onRefresh: () => void;
  readonly provider: string;
  readonly isVerified: boolean;
  readonly onTestConnection: () => void;
  readonly isTestingConnection: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionLabel htmlFor="ai_model_selector">Model</SectionLabel>
        {isVerified &&
          [
            "ollama",
            "lmstudio",
            "ai-studio",
            "openai-compatible",
            "openrouter",
            "openai",
          ].includes(provider) && (
            <Button
              variant="ghost"
              onClick={onRefresh}
              disabled={isFetching}
              className="text-xs uppercase tracking-wider font-bold text-primary hover:text-primary-light transition-colors disabled:opacity-30 h-auto p-0 cursor-pointer"
            >
              {isFetching ? "Pulling..." : "Refresh List"}
            </Button>
          )}
      </div>

      {!isVerified ? (
        <div className="h-10 px-3.5 rounded-xl border border-dashed border-border/80 bg-bg-surface/50 flex items-center justify-between text-xs text-text-muted">
          <span className="truncate pr-2">Connect provider to select model</span>
          <Button
            variant="ghost"
            onClick={onTestConnection}
            disabled={isTestingConnection}
            className="text-xs uppercase tracking-wider font-bold text-primary hover:text-primary-light transition-colors h-7 px-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 shrink-0"
          >
            {isTestingConnection ? "Testing..." : "Test Connection"}
          </Button>
        </div>
      ) : availableModels.length > 0 ? (
        <SettingSelect
          id="ai_model_selector"
          value={value}
          onChange={onChange}
          searchable={availableModels.length > 5 || provider === "openrouter"}
          searchPlaceholder={
            provider === "openrouter"
              ? "Search 300+ models or filter free..."
              : "Search models..."
          }
          showFreeBadge={provider === "openrouter"}
          showFreeFilter={provider === "openrouter"}
        >
          {!availableModels.includes(value) && value && (
            <option value={value}>{value}</option>
          )}
          {availableModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </SettingSelect>
      ) : (
        <div className="space-y-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted/50 pointer-events-none" />
            <SettingInput
              id="ai_model_selector"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="pl-9"
              placeholder={
                provider === "openrouter"
                  ? "Enter model ID (e.g. openrouter/free, anthropic/claude-3.5-sonnet)"
                  : "Enter model ID manually"
              }
            />
          </div>
          {provider === "ollama" && (
            <p className="text-xs text-amber-500/80 px-1 italic">
              No models found. Ensure Ollama is running or enter ID manually.
            </p>
          )}
          {provider === "openrouter" && (
            <p className="text-xs text-text-muted/60 px-1">
              Select any free or frontier model below, or click 'Refresh List' to fetch full
              catalogue.
            </p>
          )}
        </div>
      )}

      {provider === "openrouter" && (
        <div className="space-y-2.5 pt-2 border-t border-border/40">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3 w-3 text-emerald-400" />
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-400 font-mono">
                Free Models (Zero Cost)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OPENROUTER_FREE_MODELS.map((m) => {
                const isSelected = value === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChange(m.id)}
                    title={`${m.id} — ${m.desc}`}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer flex items-center gap-1.5",
                      isSelected
                        ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/60 font-semibold shadow-sm ring-1 ring-emerald-500/20"
                        : "bg-emerald-950/20 text-emerald-400/90 border-emerald-500/30 hover:bg-emerald-500/15 hover:border-emerald-500/50 hover:text-emerald-300",
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
