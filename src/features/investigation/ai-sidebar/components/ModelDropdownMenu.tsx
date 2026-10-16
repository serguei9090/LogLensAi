import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { useState } from "react";
import { OPENROUTER_QUICK_FREE_MODELS } from "../utils/models";

export interface ModelDropdownMenuProps {
  readonly currentProvider: string;
  readonly currentModel: string;
  readonly isFetchingModels: boolean;
  readonly verifiedProviders: readonly string[];
  readonly providerModelsCache: Record<string, string[]>;
  readonly providerConfigs: {
    readonly ollamaHost?: string;
    readonly openaiKey?: string;
    readonly geminiKey?: string;
    readonly openrouterKey?: string;
    readonly openaiCompatKey?: string;
    readonly openaiHost?: string;
    readonly lmstudioHost?: string;
  };
  readonly onFetchModels: (forceRefresh?: boolean, targetProvider?: string) => void;
  readonly onProviderChange: (provider: string) => void;
  readonly onModelChange: (model: string) => void;
}

export function ModelDropdownMenu({
  currentProvider,
  currentModel,
  isFetchingModels,
  verifiedProviders,
  providerModelsCache,
  providerConfigs,
  onFetchModels,
  onProviderChange,
  onModelChange,
}: Readonly<ModelDropdownMenuProps>) {
  const [modelSearchQuery, setModelSearchQuery] = useState("");

  const providers = [
    {
      id: "ollama",
      name: "Ollama",
      isConfigured: Boolean(providerConfigs.ollamaHost?.trim()),
    },
    {
      id: "openai",
      name: "OpenAI (Official)",
      isConfigured: Boolean(providerConfigs.openaiKey?.trim()),
    },
    {
      id: "ai-studio",
      name: "Google AI Studio",
      isConfigured: Boolean(providerConfigs.geminiKey?.trim()),
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      isConfigured: Boolean(providerConfigs.openrouterKey?.trim()),
    },
    {
      id: "openai-compatible",
      name: "OpenAI Compatible",
      isConfigured: Boolean(
        providerConfigs.openaiCompatKey?.trim() ||
          (providerConfigs.openaiHost?.trim() &&
            providerConfigs.openaiHost !== "https://api.openai.com/v1"),
      ),
    },
    {
      id: "lmstudio",
      name: "LM Studio",
      isConfigured: Boolean(providerConfigs.lmstudioHost?.trim()),
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="h-7 px-2 gap-1.5 text-xs text-text-secondary hover:text-text-primary bg-bg-surface/50 hover:bg-bg-surface border border-border-subtle/60 rounded-lg max-w-[210px] flex items-center justify-between font-normal shrink-0 cursor-pointer outline-none transition-colors"
        title={`Provider: ${currentProvider} | Model: ${currentModel}`}
      >
        <span className="truncate text-xs font-medium font-mono text-text-primary">
          {currentModel || "Select Model"}
        </span>
        {isFetchingModels ? (
          <Loader2 className="size-3 animate-spin text-text-muted shrink-0" />
        ) : (
          <ChevronDown className="size-3 text-text-muted shrink-0 opacity-70" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-56 p-1.5 bg-bg-surface border border-border-subtle shadow-xl rounded-xl z-[120]"
      >
        <div className="flex items-center justify-between px-2 py-1 select-none">
          <span className="text-xs uppercase font-bold text-text-muted tracking-wider">
            AI Providers
          </span>
          <button
            type="button"
            onClick={() => onFetchModels(true)}
            className="text-xs text-primary hover:underline cursor-pointer disabled:opacity-50"
            disabled={isFetchingModels}
          >
            {isFetchingModels ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="space-y-0.5 mt-1">
          {providers.map((provider) => {
            const isActiveProvider = currentProvider === provider.id;
            const rawModels = providerModelsCache[provider.id] || [];

            const filteredModels = modelSearchQuery.trim()
              ? rawModels.filter((m) =>
                  m.toLowerCase().includes(modelSearchQuery.trim().toLowerCase()),
                )
              : rawModels;

            if (!provider.isConfigured) {
              return (
                <div
                  key={provider.id}
                  className="relative flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-text-muted/40 cursor-not-allowed select-none group/item"
                  title="Configure API key / host in Settings to enable this provider"
                >
                  <span className="truncate">{provider.name}</span>
                  <span className="text-xs text-amber-500/60 font-medium">Not configured</span>
                </div>
              );
            }

            return (
              <DropdownMenuSub
                key={provider.id}
                onOpenChange={(open) => {
                  if (!open) {
                    setModelSearchQuery("");
                  }
                }}
              >
                <DropdownMenuSubTrigger
                  className={cn(
                    "px-2 py-1.5 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors",
                    isActiveProvider
                      ? "text-primary font-semibold hover:bg-primary/10"
                      : "text-text-secondary hover:text-text-primary hover:bg-white/5",
                  )}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{provider.name}</span>
                    {verifiedProviders.includes(provider.id) && (
                      <Check className="size-3 text-emerald-400 shrink-0" />
                    )}
                  </div>
                  {isActiveProvider && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/20 text-primary border border-primary/30 font-medium uppercase tracking-wider shrink-0 mr-1">
                      Active
                    </span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-68 p-1.5 bg-bg-surface border border-border-subtle shadow-2xl rounded-xl z-[130]">
                  <div className="flex items-center justify-between px-2 py-1 select-none border-b border-border-subtle/50 mb-1">
                    <span className="text-xs uppercase font-bold text-text-muted tracking-wider">
                      {provider.name} Models
                    </span>
                    <span className="text-xs text-text-muted/60">{rawModels.length}</span>
                  </div>

                  {/* Quick Free Models Chips for OpenRouter */}
                  {provider.id === "openrouter" && (
                    <div className="px-1.5 py-1.5 mb-1.5 rounded-lg bg-bg-app/80 border border-border-subtle/60">
                      <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider mb-1 px-0.5">
                        Quick Free Models
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {OPENROUTER_QUICK_FREE_MODELS.map((freeM) => {
                          const isCurrent = isActiveProvider && currentModel === freeM.id;
                          return (
                            <button
                              key={freeM.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isActiveProvider) {
                                  onProviderChange(provider.id);
                                }
                                onModelChange(freeM.id);
                              }}
                              title={freeM.id}
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer truncate max-w-full",
                                isCurrent
                                  ? "bg-primary/25 text-primary border-primary/50 font-bold shadow-xs"
                                  : "bg-bg-surface text-text-secondary border-border-subtle hover:border-text-muted hover:text-text-primary",
                              )}
                            >
                              {freeM.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Search bar displayed if there are more than 7 models */}
                  {rawModels.length > 7 && (
                    <div className="relative px-1 mb-1.5">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-text-muted/60 pointer-events-none" />
                      <input
                        type="text"
                        value={modelSearchQuery}
                        onChange={(e) => setModelSearchQuery(e.target.value)}
                        placeholder="Search models..."
                        className="w-full h-7 pl-7 pr-6 text-xs rounded-lg bg-bg-app border border-border-subtle/80 text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                      {modelSearchQuery && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModelSearchQuery("");
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
                        >
                          <X className="size-2.5" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {rawModels.length === 0 ? (
                      <div className="px-3 py-3 text-center text-xs text-text-muted space-y-2">
                        <p className="text-xs leading-relaxed">
                          No models loaded yet. Confirm connection and fetch available models.
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isActiveProvider) {
                              onProviderChange(provider.id);
                            }
                            onFetchModels(true, provider.id);
                          }}
                          disabled={isFetchingModels}
                          className="px-2.5 py-1 text-xs font-medium rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 cursor-pointer disabled:opacity-50 transition-colors inline-block"
                        >
                          {isFetchingModels ? "Fetching..." : "Fetch Models"}
                        </button>
                      </div>
                    ) : filteredModels.length === 0 ? (
                      <div className="px-2 py-2 text-center text-xs text-text-muted/60">
                        No models matching search
                      </div>
                    ) : (
                      filteredModels.map((m) => {
                        const isCurrentModel = isActiveProvider && currentModel === m;
                        return (
                          <DropdownMenuItem
                            key={m}
                            onClick={() => {
                              if (!isActiveProvider) {
                                onProviderChange(provider.id);
                                onModelChange(m);
                              } else {
                                onModelChange(m);
                              }
                            }}
                            className={cn(
                              "text-xs px-2 py-1.5 rounded-lg cursor-pointer flex items-center justify-between font-mono",
                              isCurrentModel
                                ? "bg-primary/15 text-primary font-bold"
                                : "text-text-secondary hover:text-text-primary hover:bg-white/5",
                            )}
                          >
                            <span className="truncate">{m}</span>
                            {isCurrentModel && (
                              <Check className="size-3 text-primary shrink-0 ml-1.5" />
                            )}
                          </DropdownMenuItem>
                        );
                      })
                    )}
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
