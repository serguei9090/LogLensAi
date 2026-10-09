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
  readonly activeCatalogScope: TargetCatalogScope | null;
  readonly onSetCatalogScope: (scope: TargetCatalogScope | null) => void;
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
  activeCatalogScope,
  onSetCatalogScope,
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
      onSetCatalogScope({
        id: item.data.sourceId,
        name: item.data.sourceName,
        workspaceId: item.data.workspaceId,
        workspaceName: item.workspaceName,
      });
    } else if (item.type === "workspace" && item.data.workspaceId) {
      onSwitchWorkspace(item.data.workspaceId);
      onSetCatalogScope(null);
    } else if (item.type === "action") {
      if (item.data.actionType === "clear_scope") {
        onSetCatalogScope(null);
      } else if (item.data.actionType === "errors_only") {
        setInput((prev) => (prev ? `${prev} (only error logs)` : "Analyze errors only"));
      }
    }

    textareaRef.current?.focus();
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
        {/* Active Target Catalog Scope Pill */}
        {activeCatalogScope && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141715]/95 border border-cyan-500/30 text-xs font-mono text-cyan-300 w-fit backdrop-blur-2xl shadow-xl animate-in fade-in slide-in-from-bottom-1">
            <FileText className="size-3.5 text-cyan-400" />
            <span className="text-text-muted">Target Catalog:</span>
            <span className="font-bold text-cyan-200">{activeCatalogScope.name}</span>
            {activeCatalogScope.workspaceName && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/20 text-cyan-300">
                {activeCatalogScope.workspaceName}
              </span>
            )}
            <button
              type="button"
              onClick={() => onSetCatalogScope(null)}
              className="ml-1 p-0.5 rounded-md hover:bg-cyan-500/20 text-cyan-400 hover:text-white transition-colors"
              title="Remove catalog scope"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        <div className="relative rounded-2xl border border-white/10 bg-[#141715]/90 backdrop-blur-2xl shadow-2xl focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
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

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type / to scope a catalog or workspace, ask telemetry questions, or request charts..."
            disabled={isLoading}
            className="min-h-[72px] max-h-48 border-0 bg-transparent resize-none text-sm text-text-primary placeholder:text-text-muted/60 focus-visible:ring-0 p-4 leading-relaxed font-sans"
          />

          <div className="flex items-center justify-between px-3.5 pb-3 pt-1 border-t border-border-subtle/30">
            <div className="flex items-center gap-2">
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
                className="h-8 gap-1.5 text-xs font-mono text-text-muted hover:text-text-primary"
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
                className="h-8 gap-1 text-xs font-mono text-text-muted hover:text-primary hover:bg-primary/5"
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
                  className="h-8 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 gap-1.5 text-xs font-mono"
                >
                  <Square className="size-3 fill-rose-400" />
                  <span>Stop</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="h-8 bg-primary hover:bg-primary-hover text-black font-bold px-3.5 gap-1.5 text-xs rounded-lg transition-transform active:scale-95 disabled:opacity-40"
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
