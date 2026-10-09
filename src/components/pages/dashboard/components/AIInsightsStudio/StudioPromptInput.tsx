// Assume Role: Frontend Engineer (@frontend)

import { FileText, Lightbulb, LightbulbOff, Send, Slash, Square, X } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { ModelDropdownMenu } from "@/components/organisms/ai-sidebar/components/ModelDropdownMenu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Workspace } from "@/store/workspaceStore";
import { SlashCommandItem, SlashCommandMenu } from "./SlashCommandMenu";

export interface TargetCatalogScope {
  id: string;
  name: string;
  workspaceId?: string;
  workspaceName?: string;
}

interface StudioPromptInputProps {
  readonly isLoading: boolean;
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
  readonly isReasoningEnabled: boolean;
  readonly workspaces: Workspace[];
  readonly currentWorkspaceId: string;
  readonly activeCatalogScopes: TargetCatalogScope[];
  readonly onSetCatalogScopes: (scopes: TargetCatalogScope[]) => void;
  readonly onSwitchWorkspace: (workspaceId: string) => void;
  readonly onToggleReasoning: () => void;
  readonly onFetchModels: (forceRefresh?: boolean, targetProvider?: string) => void;
  readonly onProviderChange: (provider: string) => void;
  readonly onModelChange: (model: string) => void;
  readonly onSendMessage: (message: string) => void;
  readonly onStopStream: () => void;
}

export function StudioPromptInput({
  isLoading,
  currentProvider,
  currentModel,
  isFetchingModels,
  verifiedProviders,
  providerModelsCache,
  providerConfigs,
  isReasoningEnabled,
  workspaces,
  currentWorkspaceId,
  activeCatalogScopes,
  onSetCatalogScopes,
  onSwitchWorkspace,
  onToggleReasoning,
  onFetchModels,
  onProviderChange,
  onModelChange,
  onSendMessage,
  onStopStream,
}: Readonly<StudioPromptInputProps>) {
  const [input, setInput] = useState("");
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Watch for slash typing
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursor = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const lastSlashIdx = textBeforeCursor.lastIndexOf("/");

    if (lastSlashIdx !== -1) {
      const queryPart = textBeforeCursor.slice(lastSlashIdx + 1);
      // Only open if slash is at start of string or preceded by whitespace
      const isWordBoundary = lastSlashIdx === 0 || /\s/.test(val[lastSlashIdx - 1]);
      if (isWordBoundary && !queryPart.includes(" ")) {
        setIsSlashMenuOpen(true);
        setSlashQuery(queryPart);
        setSlashSelectedIndex(0);
        return;
      }
    }

    setIsSlashMenuOpen(false);
  };

  const handleSelectSlashItem = (item: SlashCommandItem) => {
    // Clear the active slash query from input
    const cursor = textareaRef.current?.selectionStart || input.length;
    const textBeforeCursor = input.slice(0, cursor);
    const lastSlashIdx = textBeforeCursor.lastIndexOf("/");
    const remainingText = lastSlashIdx !== -1 ? input.slice(0, lastSlashIdx) + input.slice(cursor) : input;

    setInput(remainingText.trim());
    setIsSlashMenuOpen(false);

    if (item.type === "catalog" && item.data.sourceId && item.data.sourceName) {
      if (item.data.workspaceId && item.data.workspaceId !== currentWorkspaceId) {
        onSwitchWorkspace(item.data.workspaceId);
      }
      const newScope: TargetCatalogScope = {
        id: item.data.sourceId,
        name: item.data.sourceName,
        workspaceId: item.data.workspaceId,
        workspaceName: item.workspaceName,
      };
      // Prevent duplicates, append to active scopes list
      const alreadyExists = activeCatalogScopes.some((s) => s.id === newScope.id);
      if (!alreadyExists) {
        onSetCatalogScopes([...activeCatalogScopes, newScope]);
      }
    } else if (item.type === "workspace" && item.data.workspaceId) {
      onSwitchWorkspace(item.data.workspaceId);
      const wsName = item.title;
      const wsScope: TargetCatalogScope = {
        id: `ws-${item.data.workspaceId}`,
        name: `Workspace: ${wsName}`,
        workspaceId: item.data.workspaceId,
        workspaceName: wsName,
      };
      const alreadyExists = activeCatalogScopes.some((s) => s.id === wsScope.id);
      if (!alreadyExists) {
        onSetCatalogScopes([...activeCatalogScopes, wsScope]);
      }
    } else if (item.type === "action") {
      if (item.data.actionType === "all_catalogs") {
        const allScope: TargetCatalogScope = {
          id: `all-${currentWorkspaceId}`,
          name: "All Catalogs",
          workspaceId: currentWorkspaceId,
        };
        const alreadyExists = activeCatalogScopes.some((s) => s.id === allScope.id);
        if (!alreadyExists) {
          onSetCatalogScopes([...activeCatalogScopes, allScope]);
        }
      } else if (item.data.actionType === "clear_scope") {
        onSetCatalogScopes([]);
      } else if (item.data.actionType === "errors_only") {
        setInput((prev) => (prev ? `${prev} (only error logs)` : "Analyze errors only"));
      }
    }

    textareaRef.current?.focus();
  };

  const handleRemoveScope = (idToRemove: string) => {
    onSetCatalogScopes(activeCatalogScopes.filter((s) => s.id !== idToRemove));
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) {
      return;
    }
    onSendMessage(input.trim());
    setInput("");
    setIsSlashMenuOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashMenuOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashSelectedIndex((prev) => prev + 1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsSlashMenuOpen(false);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        // Trigger selection on current highlighted item
        const menuEl = document.querySelector(".custom-scrollbar button") as HTMLButtonElement | null;
        if (menuEl) {
          menuEl.click();
        }
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="absolute bottom-4 inset-x-0 z-30 pointer-events-none px-4 md:px-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-2 pointer-events-auto">
        <div className="relative rounded-2xl border border-white/10 bg-[#141715]/90 backdrop-blur-2xl shadow-2xl focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all px-2.5 pt-2 pb-1.5">
          {/* Autocomplete Slash Menu */}
          {isSlashMenuOpen && (
            <SlashCommandMenu
              query={slashQuery}
              selectedIndex={slashSelectedIndex}
              workspaces={workspaces}
              currentWorkspaceId={currentWorkspaceId}
              onSelect={handleSelectSlashItem}
              onClose={() => setIsSlashMenuOpen(false)}
            />
          )}

          {/* Active Target Catalog Scope Chips (Rendered inside the prompt box) */}
          {activeCatalogScopes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-2 pt-1 pb-2 border-b border-white/5 mb-1 animate-in fade-in slide-in-from-bottom-1">
              {activeCatalogScopes.map((scope) => (
                <div
                  key={scope.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-300 hover:bg-cyan-500/15 transition-colors group shadow-sm"
                >
                  <FileText className="size-3 text-cyan-400 shrink-0" />
                  <span className="font-semibold text-cyan-200 truncate max-w-[150px]">{scope.name}</span>
                  {scope.workspaceName && (
                    <span className="text-[10px] text-cyan-400/70 border-l border-cyan-500/20 pl-1.5">
                      {scope.workspaceName}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveScope(scope.id)}
                    className="ml-0.5 p-0.5 rounded hover:bg-cyan-500/25 text-cyan-400 hover:text-white transition-colors"
                    title={`Remove ${scope.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}

              {activeCatalogScopes.length > 1 && (
                <button
                  type="button"
                  onClick={() => onSetCatalogScopes([])}
                  className="text-[11px] font-mono text-text-muted hover:text-rose-400 px-1.5 py-0.5 rounded transition-colors"
                  title="Clear all attached catalogs"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type / to attach catalogs or workspaces for comparison, ask telemetry questions..."
            disabled={isLoading}
            className="min-h-[58px] max-h-48 border-0 bg-transparent resize-none text-sm text-text-primary placeholder:text-text-muted/60 focus-visible:ring-0 px-2 py-1 leading-relaxed font-sans"
          />

          <div className="flex items-center justify-between px-1.5 pt-1.5 pb-0 border-t border-border-subtle/30">
            <div className="flex items-center gap-1.5">
              <ModelDropdownMenu
                currentProvider={currentProvider}
                currentModel={currentModel}
                isFetchingModels={isFetchingModels}
                verifiedProviders={verifiedProviders}
                providerModelsCache={providerModelsCache}
                providerConfigs={providerConfigs}
                onFetchModels={onFetchModels}
                onProviderChange={onProviderChange}
                onModelChange={onModelChange}
              />

              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleReasoning}
                className="h-7.5 px-2.5 gap-1.5 text-xs font-mono text-text-muted hover:text-text-primary"
                title={isReasoningEnabled ? "Deep Reasoning On" : "Deep Reasoning Off"}
              >
                {isReasoningEnabled ? (
                  <Lightbulb className="size-3.5 text-amber-400" />
                ) : (
                  <LightbulbOff className="size-3.5 text-text-muted/60" />
                )}
                <span>{isReasoningEnabled ? "Reasoning" : "Direct"}</span>
              </Button>

              {/* Slash Quick Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInput((prev) => (prev ? `${prev} /` : "/"));
                  setIsSlashMenuOpen(true);
                  setSlashQuery("");
                  textareaRef.current?.focus();
                }}
                className="h-7.5 px-2.5 gap-1 text-xs font-mono text-text-muted hover:text-primary hover:bg-primary/5"
                title="Target catalog or workspace (/)"
              >
                <Slash className="size-3 text-primary" />
                <span>Scope</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {isLoading ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onStopStream}
                  className="h-7.5 px-3 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 gap-1.5 text-xs font-mono"
                >
                  <Square className="size-3 fill-rose-400" />
                  <span>Stop</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="h-7.5 bg-primary hover:bg-primary-hover text-black font-bold px-3.5 gap-1.5 text-xs rounded-lg transition-transform active:scale-95 disabled:opacity-40"
                >
                  <span>Send</span>
                  <Send className="size-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
