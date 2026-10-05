import { HelpTooltip } from "@/components/atoms/HelpTooltip";
import { FacetExtractionSettings } from "@/components/molecules/FacetExtractionSettings";
import { LayaSettingsPanel } from "@/components/organisms/LayaSettingsPanel";
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
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import { useIngestionStore } from "@/store/ingestionStore";
import { useInvestigationStore } from "@/store/investigationStore";
import {
  type AppSettings,
  type KeyboardShortcut,
  defaultSettings,
  useSettingsStore,
} from "@/store/settingsStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  Activity,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Eye,
  EyeOff,
  FolderOpen,
  Layers,
  Loader2,
  Network,
  Palette,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Sparkles,
  Terminal,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type SectionId = "ai" | "laya" | "drain" | "ingestion" | "general";

const SECTIONS: { id: SectionId; icon: typeof Bot; label: string; desc: string }[] = [
  { id: "ai", icon: Bot, label: "AI Intelligence", desc: "Model & analyze logic" },
  { id: "laya", icon: Zap, label: "Laya AI", desc: "Fast router & rules engine" },
  { id: "drain", icon: Cpu, label: "Engine Core", desc: "Clustering parameters" },
  { id: "ingestion", icon: Network, label: "Ingestion", desc: "Live stream listeners" },
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

function parseOptionChildren(children: React.ReactNode): Array<{ value: string; label: string }> {
  const items: Array<{ value: string; label: string }> = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      const props = child.props as { value?: string | number; children?: React.ReactNode };
      const val = props.value !== undefined ? String(props.value) : "";
      const text = props.children !== undefined ? String(props.children) : val;
      items.push({ value: val, label: text });
    }
  });
  return items;
}

function SettingSelect({
  value,
  onChange,
  id,
  children,
  className,
  placeholder = "Select option...",
  searchable = false,
  searchPlaceholder = "Search options...",
  showFreeBadge = false,
  showFreeFilter = false,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly id?: string;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly placeholder?: string;
  readonly searchable?: boolean;
  readonly searchPlaceholder?: string;
  readonly showFreeBadge?: boolean;
  readonly showFreeFilter?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => parseOptionChildren(children), [children]);
  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : value || placeholder;

  const freeCount = useMemo(() => {
    return options.filter((o) => {
      const val = o.value.toLowerCase();
      return val.endsWith(":free") || val.includes(":free") || val === "openrouter/free";
    }).length;
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!searchable && !onlyFree) {
      return options;
    }
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => {
      const val = opt.value.toLowerCase();
      const isFree = val.endsWith(":free") || val.includes(":free") || val === "openrouter/free";
      if (onlyFree && !isFree) {
        return false;
      }
      if (!q) {
        return true;
      }
      return opt.label.toLowerCase().includes(q) || val.includes(q);
    });
  }, [options, searchable, onlyFree, searchQuery]);

  useEffect(() => {
    if (isOpen && searchable) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      setSearchQuery("");
      setOnlyFree(false);
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full h-10 pl-4 pr-10 rounded-xl text-sm bg-bg-surface border text-text-primary text-left transition-all cursor-pointer flex items-center justify-between select-none relative",
          isOpen ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-border/80",
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted transition-transform duration-200">
          <ChevronDown className={cn("h-4 w-4", isOpen && "rotate-180 text-primary")} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full z-50 rounded-xl border border-border bg-[#141716] shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 flex flex-col">
          {searchable && (
            <div className="p-2 border-b border-border/80 bg-[#141716] space-y-1.5 shrink-0">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full h-8 pl-8 pr-7 text-xs rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {(showFreeFilter || freeCount > 0) && (
                <div className="flex items-center justify-between px-0.5 text-[10px]">
                  <span className="text-text-muted">
                    {filteredOptions.length} of {options.length} models
                  </span>
                  <button
                    type="button"
                    onClick={() => setOnlyFree((prev) => !prev)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-1",
                      onlyFree
                        ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 font-semibold"
                        : "bg-white/5 text-text-muted border-border hover:text-text-primary",
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Free only {freeCount > 0 && `(${freeCount})`}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              const valLower = opt.value.toLowerCase();
              const isFree =
                showFreeBadge &&
                (valLower.endsWith(":free") ||
                  valLower.includes(":free") ||
                  valLower === "openrouter/free");
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-xs rounded-lg text-left transition-colors flex items-center justify-between cursor-pointer group",
                    isSelected
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-text-primary hover:bg-white/5 hover:text-white",
                  )}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="truncate">{opt.label}</span>
                    {isFree && (
                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 shrink-0 leading-none">
                        FREE
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="p-3 text-center text-xs text-text-muted space-y-2">
                <p>No models matching "{searchQuery}"</p>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(searchQuery.trim());
                      setIsOpen(false);
                    }}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-mono bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer"
                  >
                    Use "{searchQuery.trim()}" as custom model
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({
  children,
  htmlFor,
}: {
  readonly children: React.ReactNode;
  readonly htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2 ml-1"
    >
      {children}
    </label>
  );
}

const OPENROUTER_FREE_MODELS = [
  {
    id: "openrouter/free",
    label: "Auto Free Router",
    desc: "Routes automatically to best free model",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    label: "Llama 3.3 70B",
    desc: "Meta flagship 70B",
  },
  { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1", desc: "Reasoning model" },
  { id: "deepseek/deepseek-chat:free", label: "DeepSeek V3", desc: "General chat & code" },
  { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash", desc: "Google high-speed" },
  {
    id: "qwen/qwen-2.5-coder-32b-instruct:free",
    label: "Qwen 2.5 Coder 32B",
    desc: "Specialized coding",
  },
  {
    id: "mistralai/mistral-small-24b-instruct-2501:free",
    label: "Mistral Small 24B",
    desc: "Efficient 24B",
  },
];

const OPENROUTER_POPULAR_MODELS = [
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek V3" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
];

function ModelSelector({
  value,
  onChange,
  availableModels,
  isFetching,
  onRefresh,
  provider,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly availableModels: string[];
  readonly isFetching: boolean;
  readonly onRefresh: () => void;
  readonly provider: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionLabel htmlFor="ai_model_selector">Model</SectionLabel>
        {["ollama", "lmstudio", "ai-studio", "openai-compatible", "openrouter"].includes(
          provider,
        ) && (
          <Button
            variant="ghost"
            onClick={onRefresh}
            disabled={isFetching}
            className="text-[9px] uppercase tracking-tighter font-bold text-primary hover:text-primary-light transition-colors disabled:opacity-30 h-auto p-0 cursor-pointer"
          >
            {isFetching ? "Pulling..." : "Refresh List"}
          </Button>
        )}
      </div>
      {availableModels.length > 0 ? (
        <SettingSelect
          id="ai_model_selector"
          value={value}
          onChange={onChange}
          searchable={availableModels.length > 5 || provider === "openrouter"}
          searchPlaceholder={
            provider === "openrouter" ? "Search 300+ models or filter free..." : "Search models..."
          }
          showFreeBadge={provider === "openrouter"}
          showFreeFilter={provider === "openrouter"}
        >
          {!availableModels.includes(value) && <option value={value}>{value}</option>}
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
            <p className="text-[10px] text-amber-500/80 px-1 italic">
              No models found. Ensure Ollama is running or enter ID manually.
            </p>
          )}
          {provider === "openrouter" && (
            <p className="text-[10px] text-text-muted/60 px-1">
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
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 font-mono">
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
                      "px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-1.5",
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

          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap className="h-3 w-3 text-primary" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted font-mono">
                Top Frontier Models
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OPENROUTER_POPULAR_MODELS.map((m) => {
                const isSelected = value === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChange(m.id)}
                    title={m.id}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-mono border transition-all cursor-pointer",
                      isSelected
                        ? "bg-primary/20 text-primary border-primary/40 font-semibold shadow-sm"
                        : "bg-bg-surface/60 text-text-muted border-border hover:border-text-muted hover:text-text-primary",
                    )}
                  >
                    {m.label}
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

/**
 * Safely parse a raw settings string value that may be JSON or a
 * Python repr-style string (single quotes, True/False/None).
 *
 * @param raw - Raw string value from the sidecar settings store
 * @returns Parsed value, or null if unparseable
 */
function safeParse(raw: string | null): unknown {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    // Fallback: handle Python repr strings (single quotes, True/False/None)
    try {
      const jsonified = raw
        .replaceAll("'", '"')
        .replaceAll("True", "true")
        .replaceAll("False", "false")
        .replaceAll("None", "null");
      return JSON.parse(jsonified);
    } catch (err) {
      console.debug("safeParse: Failed to parse Python repr fallback:", err);
      return null;
    }
  }
}

/**
 * Returns a short human-readable label for the active AI provider.
 * Extracted from JSX to eliminate nested ternary (Biome complexity rule).
 *
 */
function getProviderLabel(provider: string): string {
  if (provider === "openrouter") {
    return "OpenRouter Unified API";
  }
  if (provider === "gemini-cli") {
    return "Gemini CLI Integrated";
  }
  if (provider === "ollama") {
    return "Local Inference";
  }
  if (provider === "ai-studio") {
    return "Google Cloud Native";
  }
  if (provider === "lmstudio") {
    return "Local App Inference";
  }
  return "Universal API";
}

/**
 * Returns a descriptive sentence for the active AI provider.
 * Extracted from JSX to eliminate nested ternary (Biome complexity rule).
 *
 */
function getProviderDescription(provider: string): string {
  if (provider === "openrouter") {
    return "Access Claude 3.5, Llama 3.3, Gemini 2.0, DeepSeek, and GPT-4o through OpenRouter.";
  }
  if (provider === "gemini-cli") {
    return "Runs purely on your local hardware via the configured gemini-cli. Zero data egress to third-party APIs beyond the model provider.";
  }
  if (provider === "ollama") {
    return "Ensure Ollama is running and desired model is pulled locally.";
  }
  if (provider === "ai-studio") {
    return "Connect directly to Google's model infrastructure via API Key.";
  }
  if (provider === "lmstudio") {
    return "LM Studio local server. Ensure the server is started in the LM Studio SDK tab.";
  }
  return "Supports Azure, Groq, Perplexity, or any OpenAI-compatible proxy.";
}

/**
 * Maps a flat record of raw sidecar setting strings into a typed AppSettings object.
 * Hoisted to module scope to reduce SettingsPanel's cognitive complexity below the 15-point
 * Biome threshold. Relies on the module-level `safeParse` for JSON fields.
 *

 * @param remoteSettings - Raw key/value pairs from the `get_settings` JSON-RPC method
 * @param prev - Previous AppSettings to spread as base (preserves fields not in remote)
 * @returns Fully typed AppSettings object
 */
function parseRemote(remoteSettings: Record<string, string>, prev: AppSettings): AppSettings {
  const next = {
    ...prev,
    ...remoteSettings,
    drain_similarity_threshold: Number.parseFloat(
      remoteSettings.drain_similarity_threshold || "0.4",
    ),
    drain_max_children: Number.parseInt(remoteSettings.drain_max_children || "100", 10),
    drain_max_clusters: Number.parseInt(remoteSettings.drain_max_clusters || "1000", 10),
    mcp_server_enabled: remoteSettings.mcp_server_enabled?.toLowerCase() === "true",
    ai_tool_search: remoteSettings.ai_tool_search?.toLowerCase() !== "false",
    ai_tool_memory: remoteSettings.ai_tool_memory?.toLowerCase() !== "false",
    ingestion_syslog_enabled: remoteSettings.ingestion_syslog_enabled?.toLowerCase() !== "false",
    ingestion_syslog_port: Number.parseInt(remoteSettings.ingestion_syslog_port || "514", 10),
    ingestion_http_enabled: remoteSettings.ingestion_http_enabled?.toLowerCase() !== "false",
    ingestion_http_port: Number.parseInt(remoteSettings.ingestion_http_port || "5002", 10),
    drain_masks: (() => {
      const parsed = safeParse(remoteSettings.drain_masks);
      return Array.isArray(parsed) ? parsed : defaultSettings.drain_masks;
    })(),
    facet_extractions: (() => {
      const parsed = safeParse(remoteSettings.facet_extractions);
      return Array.isArray(parsed) ? parsed : [];
    })(),
    ui_command_palette_shortcut: (() => {
      const raw = remoteSettings.ui_command_palette_shortcut;
      if (!raw) {
        return defaultSettings.ui_command_palette_shortcut;
      }

      const parsed = safeParse(raw);
      if (parsed && typeof parsed === "object" && "key" in parsed) {
        return parsed as KeyboardShortcut;
      }
      // Legacy support: if it's just a single character string
      if (typeof raw === "string" && raw.length === 1) {
        return { key: raw, ctrl: true };
      }
      return defaultSettings.ui_command_palette_shortcut;
    })(),
  };

  if (Array.isArray(next.drain_masks)) {
    next.drain_masks = next.drain_masks.filter((m) => m.label.trim() || m.pattern.trim());
    if (next.drain_masks.length === 0) {
      next.drain_masks = defaultSettings.drain_masks;
    }
  }
  if (Array.isArray(next.facet_extractions)) {
    next.facet_extractions = next.facet_extractions.filter((f) => f.name.trim() || f.regex.trim());
  }
  return next;
}

function ShortcutCapture({
  value,
  onChange,
}: {
  readonly value: KeyboardShortcut;
  readonly onChange: (v: KeyboardShortcut) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser defaults for most keys while recording
      if (e.key !== "Escape" && !e.key.startsWith("F")) {
        e.preventDefault();
      }
      e.stopPropagation();

      // We only care about the key if it's not a modifier itself
      if (!["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        if (e.key === "Escape") {
          setIsRecording(false);
          return;
        }

        const shortcut: KeyboardShortcut = {
          key: e.key.toLowerCase(),
          ctrl: e.ctrlKey,
          alt: e.altKey,
          shift: e.shiftKey,
          meta: e.metaKey,
        };

        onChange(shortcut);
        setIsRecording(false);
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown, true);
    return () => globalThis.removeEventListener("keydown", handleKeyDown, true);
  }, [isRecording, onChange]);

  const displayShortcut = () => {
    // Use optional chain — value or value.key may be undefined during legacy migration
    if (!value?.key) {
      return "None";
    }
    const parts = [];
    if (value.ctrl) {
      parts.push("Ctrl");
    }
    if (value.alt) {
      parts.push("Alt");
    }
    if (value.shift) {
      parts.push("Shift");
    }
    if (value.meta) {
      parts.push("Win/Cmd");
    }
    parts.push(value.key.toUpperCase());
    return parts.join(" + ");
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "h-10 px-4 rounded-xl flex items-center justify-center font-mono text-sm border transition-all min-w-[140px]",
          isRecording
            ? "bg-primary/20 border-primary text-primary animate-pulse"
            : "bg-bg-surface border-border text-text-primary",
        )}
      >
        {isRecording ? "Press Any Key" : displayShortcut()}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsRecording(!isRecording)}
        className={cn(
          "h-10 px-6 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
          isRecording
            ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
            : "bg-bg-surface border-border hover:bg-white/5",
        )}
      >
        {isRecording ? "Cancel (Esc)" : "Change Shortcut"}
      </Button>
    </div>
  );
}

export function SettingsPanel({ onSave }: { readonly onSave: (settings: AppSettings) => void }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [activeSection, setActiveSection] = useState<SectionId>("ai");
  const [saved, setSaved] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isResetPatternsModalOpen, setIsResetPatternsModalOpen] = useState(false);
  const [isFactoryResetModalOpen, setIsFactoryResetModalOpen] = useState(false);

  // Engine Core Collapsible Accordion State
  const [isClusteringOpen, setIsClusteringOpen] = useState(true);
  const [isTimestampOpen, setIsTimestampOpen] = useState(false);
  const [isFacetsOpen, setIsFacetsOpen] = useState(false);
  const { activeWorkspaceId, reset: resetWorkspaces } = useWorkspaceStore();
  const { clearState: clearIngestion } = useIngestionStore();
  const { reset: resetInvestigation } = useInvestigationStore();
  const { updateSettings } = useSettingsStore();

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K], immediate = true) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    if (immediate) {
      onSave(newSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const handleResetAll = async () => {
    try {
      // Use the store's updateSettings to ensure complex types (masks, facets)
      // are stringified correctly before sending to the sidecar.
      await updateSettings(defaultSettings);

      toast.success("Settings reset to defaults successfully");

      // Delay reload slightly to let toast be seen and DB to commit
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

      // 1. Backend Wipe
      await callSidecar({ method: "factory_reset", params: {} });

      // 2. Frontend Wipe
      clearIngestion(); // Remove any ghost jobs
      resetWorkspaces(); // Clear workspace definitions
      resetInvestigation(); // Clear source metadata and cached logs
      localStorage.clear(); // Nuclear option for all persisted stores

      toast.success("Factory reset complete. Application will restart.");

      // 3. Forced Reload — use globalThis for Biome compatibility
      globalThis.setTimeout(() => {
        globalThis.location.reload();
      }, 1500);
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

  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const handleTestConnection = async () => {
    // Ensure current settings are saved before testing.
    // onSave returns void, so no await needed — calling synchronously is correct.
    onSave(settings);

    setIsTestingConnection(true);
    try {
      const res = await callSidecar<{ status: string; message: string }>({
        method: "test_ai_connection",
        params: {},
      });
      if (res.status === "success") {
        toast.success(res.message);
      } else if (res.status === "warning") {
        toast.warning(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      // Log the full error for debug traceability, then surface a user-friendly toast
      console.error("Failed to test AI connection:", error);
      toast.error("Failed to test connection");
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Load settings on mount
  useEffect(() => {
    // parseRemote is defined at module scope to reduce cognitive complexity
    // of this component function (Biome complexity rule).
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

  const fetchModels = useCallback(async () => {
    setIsFetchingModels(true);
    try {
      const models = await callSidecar<string[]>({ method: "list_ai_models", params: {} });
      if (models && Array.isArray(models)) {
        setAvailableModels(models);
      }
    } catch (e) {
      console.error("Failed to fetch ai models:", e);
    } finally {
      setIsFetchingModels(false);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Must re-fetch on these changes even if not directly used in the effect body
  useEffect(() => {
    // Trigger model pull when provider or connectivity settings change (with debounce)
    const dynamicProviders = ["ollama", "lmstudio", "openai-compatible", "ai-studio", "openrouter"];
    if (dynamicProviders.includes(settings.ai_provider)) {
      const timer = setTimeout(() => {
        fetchModels();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [
    fetchModels,
    settings.ai_provider,
    settings.ai_api_key,
    settings.ai_ollama_host,
    settings.ai_lmstudio_host,
    settings.ai_openai_host,
    settings.ai_openrouter_host,
  ]);

  // Removed handleSave in favor of auto-save via update()

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
                <p className="text-[13px] font-semibold">{label}</p>
                <p className="text-[10px] mt-0.5 opacity-60 leading-none">{desc}</p>
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
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-500",
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
            className="flex items-center gap-2 px-4 py-3 text-text-muted hover:text-amber-400 hover:bg-amber-500/5 rounded-2xl text-[11px] font-bold uppercase transition-all border border-transparent hover:border-amber-500/10 group h-auto w-full justify-start"
          >
            <RotateCcw className="size-4 shrink-0 opacity-50 group-hover:opacity-100" />
            Reset Settings
          </Button>

          <Button
            variant="ghost"
            onClick={() => setIsFactoryResetModalOpen(true)}
            className="flex items-center gap-2 px-4 py-3 text-text-muted hover:text-red-400 hover:bg-red-500/5 rounded-2xl text-[11px] font-bold uppercase transition-all border border-transparent hover:border-red-500/10 group h-auto w-full justify-start"
          >
            <Trash2 className="size-4 shrink-0 opacity-50 group-hover:opacity-100" />
            Factory Reset
          </Button>
        </div>
      </aside>
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
                      let newModel = settings.ai_model;
                      if (v === "ollama") {
                        newModel = "gemma4:e2b";
                      } else if (v === "gemini-cli") {
                        newModel = "flash";
                      } else if (v === "openai-compatible") {
                        newModel = "gpt-4o";
                      } else if (v === "openrouter") {
                        newModel = "anthropic/claude-3.5-sonnet";
                      } else if (v === "ai-studio") {
                        newModel = "gemini-2.0-flash";
                      }

                      const updated = { ...settings, ai_provider: v, ai_model: newModel };
                      setSettings(updated);
                      onSave(updated);
                      setSaved(true);
                      setTimeout(() => setSaved(false), 2000);
                    }}
                  >
                    <option value="gemini-cli">Gemini CLI</option>
                    <option value="ollama">Ollama</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="lmstudio">LM Studio</option>
                    <option value="ai-studio">Gemini AI Studio</option>
                    <option value="openai-compatible">OpenAI Compatible</option>
                  </SettingSelect>
                </div>

                {settings.ai_provider === "gemini-cli" && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex items-center justify-between">
                      <SectionLabel htmlFor="ai_gemini_url">A2A Server URL</SectionLabel>
                      <Button
                        variant="ghost"
                        onClick={handleTestConnection}
                        disabled={isTestingConnection}
                        className="text-[9px] uppercase tracking-tighter font-bold text-primary hover:text-primary-light transition-colors disabled:opacity-30 h-auto p-0"
                      >
                        {isTestingConnection ? "Testing..." : "Test Connection"}
                      </Button>
                    </div>
                    <SettingInput
                      id="ai_gemini_url"
                      type="url"
                      value={settings.ai_gemini_url}
                      onChange={(e) => update("ai_gemini_url", e.target.value, false)}
                      onBlur={() => onSave(settings)}
                      placeholder="http://localhost:22436"
                    />
                    <p className="text-[10px] text-text-muted/50 px-1">Daemon port for Hot Mode.</p>
                  </div>
                )}

                {settings.ai_provider === "ollama" && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex items-center justify-between">
                      <SectionLabel htmlFor="ai_ollama_host">Ollama Server Host</SectionLabel>
                      <Button
                        variant="ghost"
                        onClick={handleTestConnection}
                        disabled={isTestingConnection}
                        className="text-[9px] uppercase tracking-tighter font-bold text-primary hover:text-primary-light transition-colors disabled:opacity-30 h-auto p-0"
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
                    <p className="text-[10px] text-text-muted/50 px-1">
                      Local Ollama instance URL.
                    </p>
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
                        className="text-[9px] uppercase tracking-tighter font-bold text-primary hover:text-primary-light transition-colors disabled:opacity-30 h-auto p-0"
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
                    <p className="text-[10px] text-text-muted/50 px-1">
                      Local LM Studio API URL (usually port 1234).
                    </p>
                  </div>
                )}

                {(settings.ai_provider === "ai-studio" ||
                  settings.ai_provider === "openai-compatible" ||
                  settings.ai_provider === "openrouter") && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex items-center justify-between">
                      <SectionLabel htmlFor="ai_api_key">Secret API Key</SectionLabel>
                      <Button
                        variant="ghost"
                        onClick={handleTestConnection}
                        disabled={isTestingConnection || !settings.ai_api_key}
                        className="text-[9px] uppercase tracking-tighter font-bold text-primary hover:text-primary-light transition-colors disabled:opacity-30 h-auto p-0"
                      >
                        {isTestingConnection ? "Testing..." : "Test Connection"}
                      </Button>
                    </div>
                    <div className="relative group/key">
                      <SettingInput
                        id="ai_api_key"
                        type={showApiKey ? "text" : "password"}
                        value={settings.ai_api_key}
                        onChange={(e) => update("ai_api_key", e.target.value, false)}
                        onBlur={() => onSave(settings)}
                        placeholder={
                          settings.ai_provider === "openrouter"
                            ? "sk-or-v1-••••••••••••••••"
                            : "Encrypted: sk-••••••••••••••••"
                        }
                        className="pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-1"
                      >
                        {showApiKey ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </Button>
                    </div>
                    <p className="text-[10px] text-text-muted/50 px-1">
                      {settings.ai_provider === "openrouter"
                        ? "OpenRouter API Key. Stored securely in local DuckDB settings."
                        : "Keys are stored securely locally. Optional for some local engines (e.g., LM Studio)."}
                    </p>
                  </div>
                )}
              </div>

              {/* Model Selector Row */}
              <div className="grid grid-cols-2 gap-8 pt-4 border-t border-border/30">
                {settings.ai_provider === "gemini-cli" ? (
                  <div className="space-y-2">
                    <SectionLabel htmlFor="ai_model">Gemini Model Strategy</SectionLabel>
                    <SettingSelect
                      id="ai_model"
                      value={settings.ai_model}
                      onChange={(v) => update("ai_model", v)}
                    >
                      <option value="flash">Flash</option>
                      <option value="pro">Pro</option>
                      <option value="flash-lite">Flash Lite</option>
                      <option value="auto">Auto</option>
                      <option value="auto-gemini-3">Auto Gemini 3</option>
                      <option value="auto-gemini-2.5">Auto Gemini 2.5</option>
                    </SettingSelect>
                    <p className="text-[10px] text-text-muted/50 px-1">
                      Choose 'Flash' for speed or 'Pro' for deeper analysis.
                    </p>
                  </div>
                ) : (
                  <ModelSelector
                    value={settings.ai_model}
                    onChange={(v) => update("ai_model", v)}
                    availableModels={availableModels}
                    isFetching={isFetchingModels}
                    onRefresh={fetchModels}
                    provider={settings.ai_provider}
                  />
                )}

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
                    <p className="text-[10px] text-text-muted/50 px-1">
                      Protocol & host for the OpenAI-compatible endpoint (e.g., LM Studio, Groq,
                      vLLM).
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
                    <p className="text-[10px] text-text-muted/50 px-1">
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
                  <p className="text-[11px] font-bold text-primary uppercase tracking-wider">
                    {getProviderLabel(settings.ai_provider)}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    {getProviderDescription(settings.ai_provider)}
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
                  onChange={(e) => update("ai_system_prompt", e.target.value, false)}
                  onBlur={() => onSave(settings)}
                  rows={6}
                  className="w-full px-4 py-3 rounded-2xl text-xs font-mono bg-bg-surface border border-border text-text-primary placeholder:text-text-muted/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none transition-all"
                />
              </div>

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
          )}

          {/* Engine Core Section */}
          {activeSection === "drain" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="border-b border-border pb-6">
                <h2 className="text-2xl font-bold text-text-primary">Global Core Engine</h2>
                <p className="text-sm text-text-muted mt-2">
                  System-wide defaults for log parsing, clustering, and pattern discovery.
                </p>
              </div>

              {/* Collapsible Card 1: Drain3 Clustering Engine */}
              <div className="bg-bg-surface/30 border border-border/80 rounded-2xl overflow-hidden transition-all shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsClusteringOpen(!isClusteringOpen)}
                  className="w-full flex items-center justify-between p-5 bg-bg-surface/40 hover:bg-bg-surface/70 transition-colors text-left cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="bg-primary/20 p-2.5 rounded-xl border border-primary/20">
                      <Layers className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-text-primary">
                          Drain3 Clustering Engine
                        </h3>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        Template discovery, similarity thresholds, and variable masking heuristics.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 text-text-muted transition-transform duration-200",
                        isClusteringOpen && "rotate-180 text-primary",
                      )}
                    />
                  </div>
                </button>

                {isClusteringOpen && (
                  <div className="p-6 pt-3 space-y-6 border-t border-border/50 animate-in fade-in-50 duration-200">
                    <div className="grid grid-cols-3 gap-8 pt-2">
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
                            update(
                              "drain_similarity_threshold",
                              Number.parseFloat(e.target.value),
                              false,
                            )
                          }
                          onBlur={() => onSave(settings)}
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
                            update("drain_max_children", Number.parseInt(e.target.value, 10), false)
                          }
                          onBlur={() => onSave(settings)}
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
                            update("drain_max_clusters", Number.parseInt(e.target.value, 10), false)
                          }
                          onBlur={() => onSave(settings)}
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
                        The similarity threshold determines how 'close' two log lines must be to
                        share a template. Lower values 0.1–0.4 are better for high-variance logs.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <SectionLabel>Variable Masking</SectionLabel>
                        <Button
                          variant="ghost"
                          onClick={handleResetMasks}
                          className="text-[10px] font-bold text-primary/60 hover:text-primary transition-colors flex items-center gap-1.5 uppercase pr-1 cursor-pointer h-auto p-0"
                        >
                          <RotateCcw className="size-3" />
                          Reset to Standard
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] text-text-muted px-1 -mt-2">
                          Sanitize logs by replacing dynamic variables like IPs or IDs with tokens
                          before clustering.
                        </p>

                        {/* Standard Heuristics Visibility */}
                        <div className="bg-bg-card/30 border border-border rounded-xl p-3 space-y-2 opacity-80 scale-[0.98] origin-left">
                          <p className="text-[10px] font-bold text-primary-muted uppercase tracking-wider mb-1">
                            Standard System Heuristics
                          </p>
                          <div className="flex items-center justify-between gap-4 py-1 border-b border-primary/10">
                            <span className="text-[10px] font-semibold text-text-primary">
                              IP ADDRESS
                            </span>
                            <span className="text-[9px] font-mono text-text-muted truncate">
                              IPv4 / IPv6 Formats
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 py-1 border-b border-primary/10">
                            <span className="text-[10px] font-semibold text-text-primary">
                              UUID / GUID
                            </span>
                            <span className="text-[9px] font-mono text-text-muted truncate">
                              Standard 36-char markers
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 py-1 border-b border-primary/10">
                            <span className="text-[10px] font-semibold text-text-primary">
                              HEX MEMORY / HASH
                            </span>
                            <span className="text-[9px] font-mono text-text-muted truncate">
                              0x... addresses & sha hashes
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 py-1 border-b border-primary/10">
                            <span className="text-[10px] font-semibold text-text-primary">
                              DURATION
                            </span>
                            <span className="text-[9px] font-mono text-text-muted truncate">
                              took ...ms / ...s latencies
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 py-1 border-b border-primary/10">
                            <span className="text-[10px] font-semibold text-text-primary">
                              EMAIL
                            </span>
                            <span className="text-[9px] font-mono text-text-muted truncate">
                              user@domain addresses
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 py-1 border-b border-primary/10">
                            <span className="text-[10px] font-semibold text-text-primary">
                              MAC ADDRESS
                            </span>
                            <span className="text-[9px] font-mono text-text-muted truncate">
                              xx:xx:xx:xx:xx:xx hardware IDs
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 py-1">
                            <span className="text-[10px] font-semibold text-text-primary">
                              DATETIME
                            </span>
                            <span className="text-[9px] font-mono text-text-muted truncate">
                              ISO / RFC3339 timestamps
                            </span>
                          </div>
                        </div>
                        {(Array.isArray(settings.drain_masks) ? settings.drain_masks : []).map(
                          (mask, idx) => (
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
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  const newMasks = settings.drain_masks.filter((_, i) => i !== idx);
                                  update("drain_masks", newMasks);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-red-400 transition-all cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          ),
                        )}

                        <Button
                          variant="ghost"
                          onClick={() => {
                            update("drain_masks", [
                              ...settings.drain_masks,
                              { label: "NEW_MASK", pattern: "", enabled: true },
                            ]);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-xl text-[10px] font-bold text-text-muted hover:border-primary hover:text-primary hover:bg-primary/5 transition-all uppercase tracking-tighter cursor-pointer h-auto"
                        >
                          <Plus className="size-3" />
                          Add Custom Masking Instruction
                        </Button>
                      </div>
                    </div>

                    {/* Reset Templates within Drain3 Section */}
                    <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-red-400">Pattern Memory</p>
                        <p className="text-[10px] text-text-muted mt-1 max-w-[300px]">
                          Clearing patterns will force the engine to re-learn log templates from
                          scratch. This does not affect your masking rules.
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => setIsResetPatternsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-bold transition-all border border-red-500/20 h-auto"
                      >
                        <RefreshCcw className="size-3.5" />
                        Clear Pattern Cache
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible Card 2: Log Timestamp Extraction & Detection */}
              <div className="bg-bg-surface/30 border border-border/80 rounded-2xl overflow-hidden transition-all shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsTimestampOpen(!isTimestampOpen)}
                  className="w-full flex items-center justify-between p-5 bg-bg-surface/40 hover:bg-bg-surface/70 transition-colors text-left cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="bg-primary/20 p-2.5 rounded-xl border border-primary/20">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-text-primary">
                          Log Timestamp Extraction & Detection
                        </h3>
                        <span
                          className={cn(
                            "text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border",
                            settings.timestamp_auto_detect
                              ? "bg-primary/15 text-primary border-primary/25"
                              : "bg-bg-surface text-text-muted border-border",
                          )}
                        >
                          {settings.timestamp_auto_detect ? "Auto-Detect On" : "Manual / Disabled"}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        Control how dates and timezones are automatically detected or parsed from
                        log lines.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 text-text-muted transition-transform duration-200",
                        isTimestampOpen && "rotate-180 text-primary",
                      )}
                    />
                  </div>
                </button>

                {isTimestampOpen && (
                  <div className="p-6 pt-3 space-y-6 border-t border-border/50 animate-in fade-in-50 duration-200">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-bg-surface/50 border border-border rounded-xl p-4 hover:bg-bg-surface transition-colors">
                        <div>
                          <p className="text-sm font-bold text-text-primary">
                            Auto-Detect Timestamps
                          </p>
                          <p className="text-[10px] text-text-muted mt-0.5">
                            Scan log messages automatically for standard date formats (ISO, Apache,
                            Syslog, etc.).
                          </p>
                        </div>
                        <Switch
                          checked={settings.timestamp_auto_detect}
                          onCheckedChange={(checked) => update("timestamp_auto_detect", checked)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-6 pt-2">
                        <div className="space-y-2">
                          <SectionLabel htmlFor="timestamp_custom_regex">
                            Custom Timestamp Regex
                          </SectionLabel>
                          <SettingInput
                            id="timestamp_custom_regex"
                            type="text"
                            value={settings.timestamp_custom_regex || ""}
                            onChange={(e) =>
                              update("timestamp_custom_regex", e.target.value, false)
                            }
                            onBlur={() => onSave(settings)}
                            placeholder="e.g. ^\[(?P<timestamp>[^\]]+)\]"
                          />
                          <p className="text-[10px] text-text-muted/50 px-1">
                            Use a custom regex pattern to extract the timestamp string (requires a{" "}
                            <code>?P&lt;timestamp&gt;</code> capture group).
                          </p>
                        </div>

                        <div className="space-y-2">
                          <SectionLabel htmlFor="timestamp_custom_format">
                            Custom Timestamp Format
                          </SectionLabel>
                          <SettingInput
                            id="timestamp_custom_format"
                            type="text"
                            value={settings.timestamp_custom_format || ""}
                            onChange={(e) =>
                              update("timestamp_custom_format", e.target.value, false)
                            }
                            onBlur={() => onSave(settings)}
                            placeholder="e.g. %d/%b/%Y:%H:%M:%S"
                          />
                          <p className="text-[10px] text-text-muted/50 px-1">
                            Optionally provide a custom <code>strptime</code> format string to parse
                            the extracted timestamp.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible Card 3: Metadata Extraction (Facets) */}
              <div className="bg-bg-surface/30 border border-border/80 rounded-2xl overflow-hidden transition-all shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsFacetsOpen(!isFacetsOpen)}
                  className="w-full flex items-center justify-between p-5 bg-bg-surface/40 hover:bg-bg-surface/70 transition-colors text-left cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20">
                      <Activity className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-text-primary">
                          Metadata Extraction (Facets)
                        </h3>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                          {(settings.facet_extractions || []).filter((r) => r.enabled).length} Rules
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        Regex rules and capturing groups to extract structured fields from raw text
                        into queryable facets.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 text-text-muted transition-transform duration-200",
                        isFacetsOpen && "rotate-180 text-primary",
                      )}
                    />
                  </div>
                </button>

                {isFacetsOpen && (
                  <div className="p-6 pt-3 space-y-6 border-t border-border/50 animate-in fade-in-50 duration-200">
                    <FacetExtractionSettings
                      rules={settings.facet_extractions || []}
                      onChange={(rules) => update("facet_extractions", rules)}
                      title="Global Extraction Rules"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ingestion Section */}
          {activeSection === "ingestion" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="border-b border-border pb-6">
                <h2 className="text-2xl font-bold text-text-primary">Network Ingestion</h2>
                <p className="text-sm text-text-muted mt-2">
                  Listen for live log streams from external servers via common protocols.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between bg-bg-surface/50 border border-border rounded-2xl p-6 hover:bg-bg-surface transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/20 p-2.5 rounded-xl">
                      <Terminal className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary">Syslog UDP Listener</p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Accept logs from Linux/Unix servers using standard syslog format.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <SectionLabel htmlFor="syslog_port">UDP Port</SectionLabel>
                      <input
                        id="syslog_port"
                        type="number"
                        className="w-20 h-8 rounded-lg bg-bg-surface border border-border text-center text-xs text-text-primary focus:outline-none focus:border-primary transition-all"
                        value={settings.ingestion_syslog_port}
                        onChange={(e) =>
                          update(
                            "ingestion_syslog_port",
                            Number.parseInt(e.target.value, 10),
                            false,
                          )
                        }
                        onBlur={() => onSave(settings)}
                      />
                    </div>
                    <Switch
                      checked={settings.ingestion_syslog_enabled}
                      onCheckedChange={(checked) => update("ingestion_syslog_enabled", checked)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-bg-surface/50 border border-border rounded-2xl p-6 hover:bg-bg-surface transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-500/10 p-2.5 rounded-xl">
                      <Activity className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary">HTTP Ingestion API</p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Ingest logs via POST requests to <code>/ingest</code> using JSON payloads.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <SectionLabel htmlFor="http_port">TCP Port</SectionLabel>
                      <input
                        id="http_port"
                        type="number"
                        className="w-20 h-8 rounded-lg bg-bg-surface border border-border text-center text-xs text-text-primary focus:outline-none focus:border-primary transition-all"
                        value={settings.ingestion_http_port}
                        onChange={(e) =>
                          update("ingestion_http_port", Number.parseInt(e.target.value, 10), false)
                        }
                        onBlur={() => onSave(settings)}
                      />
                    </div>
                    <Switch
                      checked={settings.ingestion_http_enabled}
                      onCheckedChange={(checked) => update("ingestion_http_enabled", checked)}
                    />
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-2 font-mono">
                    Routing Instructions
                  </p>
                  <p className="text-[10px] text-text-secondary leading-relaxed space-y-2 flex flex-col">
                    <span>
                      To route logs to a specific workspace and collection, use the path:{" "}
                      <code className="bg-white/5 px-1.5 py-0.5 rounded text-text-primary ml-1">
                        POST http://localhost:{settings.ingestion_http_port}
                        /ingest/my-workspace/my-collection
                      </code>
                    </span>
                    <span>
                      Or use query parameters:{" "}
                      <code className="bg-white/5 px-1.5 py-0.5 rounded text-text-primary ml-1">
                        /ingest?ws=my-workspace&source_id=my-collection
                      </code>
                    </span>
                  </p>
                </div>
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
                    <option value="default">Balanced</option>
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

              <div className="pt-8 border-t border-border/30">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">Keyboard Shortcuts</h3>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Customize global key bindings for faster navigation.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-5 bg-bg-surface/50 border border-border rounded-2xl group hover:bg-bg-surface transition-all">
                    <div>
                      <p className="text-sm font-bold text-text-primary">Command Palette</p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Quickly navigate workspaces and sources.
                      </p>
                    </div>
                    <ShortcutCapture
                      value={settings.ui_command_palette_shortcut}
                      onChange={(key) => update("ui_command_palette_shortcut", key)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Laya System 1 Section */}
          {activeSection === "laya" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="border-b border-border pb-6">
                <h2 className="text-2xl font-bold text-text-primary">Laya System 1 Accelerator</h2>
                <p className="text-sm text-text-muted mt-2">
                  Configure fast routing, cluster triage rules, and versioned checkpoints.
                </p>
              </div>
              <LayaSettingsPanel />
            </div>
          )}
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
              <span className="text-red-400 font-bold uppercase text-[10px]">
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
              <span className="text-red-400 font-bold uppercase text-[10px]">
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
