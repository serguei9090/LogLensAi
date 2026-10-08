import { AIHistorySearchModal } from "@/components/organisms/AIHistorySearchModal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useAiStore } from "@/store/aiStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUIStore } from "@/store/uiStore";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import { Clock, MessageSquare, Pencil, Plus, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FilterEntry } from "@/components/molecules/FilterBuilder";
import { AIMessageRow } from "./components/AIMessageRow";
import { SidebarInputBar } from "./components/SidebarInputBar";

export interface AIInvestigationSidebarProps {
  readonly onEngineSettingsOpen?: () => void;
}

export function AIInvestigationSidebar({
  onEngineSettingsOpen: _onEngineSettingsOpen,
}: AIInvestigationSidebarProps = {}) {
  const {
    isSidebarOpen,
    setSidebarOpen,
    sidebarWidth,
    setSidebarWidth,
    messages,
    sessions,
    currentSessionId,
    setSession,
    fetchSessions,
    renameSession,
    sendMessage,
    stopStream,
    isLoading,
  } = useAiStore();

  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const {
    settings,
    fetchSettings,
    updateSettings,
    flushPendingSettings,
    verifiedProviders,
    markProviderVerified,
    providerModelsCache,
    setProviderCachedModels,
  } = useSettingsStore();
  const { selectedLogIds, clearSelection } = useInvestigationStore();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [pendingSessionName, setPendingSessionName] = useState("");
  const [isReasoningEnabled, setIsReasoningEnabled] = useState(true);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchModels = useCallback(
    async (forceRefresh = false, targetProvider?: string) => {
      const currentProvider = targetProvider || settings.ai_provider;
      if (!currentProvider) {
        return;
      }

      if (!forceRefresh && providerModelsCache[currentProvider]?.length) {
        return;
      }

      setIsFetchingModels(true);
      try {
        if (targetProvider && targetProvider !== settings.ai_provider) {
          await updateSettings({ ai_provider: targetProvider });
          await flushPendingSettings();
        } else if (forceRefresh) {
          await flushPendingSettings();
        }
        const models = await callSidecar<string[]>({ method: "list_ai_models", params: {} });
        if (models && Array.isArray(models) && models.length > 0) {
          markProviderVerified(currentProvider);
          setProviderCachedModels(currentProvider, models);
        }
      } catch (e) {
        console.error("Failed to fetch ai models:", e);
      } finally {
        setIsFetchingModels(false);
      }
    },
    [
      settings.ai_provider,
      providerModelsCache,
      flushPendingSettings,
      updateSettings,
      markProviderVerified,
      setProviderCachedModels,
    ],
  );

  const handleProviderChange = (newProvider: string) => {
    let newModel = "";
    const cached = providerModelsCache[newProvider];
    if (cached && cached.length > 0) {
      newModel = cached[0];
    }
    updateSettings({ ai_provider: newProvider, ai_model: newModel });
  };

  const handleModelChange = (modelName: string) => {
    updateSettings({ ai_model: modelName });
  };

  const handleA2UIAction = useCallback((action: unknown) => {
    if (!action || typeof action !== "object" || !("type" in action)) {
      return;
    }

    const a = action as {
      type: string;
      field?: string;
      value?: unknown;
      operator?: FilterEntry["operator"];
      query?: string;
      command?: string;
      id?: string;
      label?: string;
      width?: string;
      source?: "auto" | "user";
      regex?: string;
    };

    switch (a.type) {
      case "filter": {
        if (a.field && a.value) {
          const newFilter: FilterEntry = {
            id: Date.now().toString(),
            field: a.field,
            value: a.value as string,
            operator: a.operator || "equals",
          };
          useInvestigationStore.getState().setFilters([newFilter]);
        }
        break;
      }
      case "search": {
        if (a.query) {
          useInvestigationStore.getState().setSearchQuery(a.query);
        }
        break;
      }
      case "add_column": {
        if (a.label) {
          const colId = a.id || `col-${Date.now()}`;
          const existing = useUIStore.getState().customColumns.find((c) => c.id === colId);
          if (!existing) {
            useUIStore.getState().addCustomColumn({
              id: colId,
              label: a.label,
              width: a.width || "120px",
              source: a.source || "user",
              regex: a.regex,
            });
          }
        }
        break;
      }
      default:
        console.warn("Unhandled A2UI action:", a);
    }
  }, []);

  const generateDefaultName = useCallback(() => {
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `LOG-${rand}`;
  }, []);

  const currentSession = sessions.find((s) => s.session_id === currentSessionId);
  const displayTitle = currentSession?.name || pendingSessionName || "Investigation Hub";

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }
    if (activeWorkspace?.id) {
      fetchSessions(activeWorkspace.id);
    }
    fetchSettings();
  }, [activeWorkspace?.id, isSidebarOpen, fetchSessions, fetchSettings]);

  useEffect(() => {
    if (!currentSessionId && !pendingSessionName) {
      setPendingSessionName(generateDefaultName());
    }
  }, [currentSessionId, pendingSessionName, generateDefaultName]);

  useEffect(() => {
    if (currentSession) {
      setEditedTitle(currentSession.name);
    } else {
      setEditedTitle(pendingSessionName);
    }
  }, [currentSession, pendingSessionName]);

  // Scroll logic
  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [currentSessionId]);

  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, messages.at(-1)?.content]);

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || !activeWorkspace?.id) {
      return;
    }

    await sendMessage({
      workspace_id: activeWorkspace.id,
      message: messageText,
      context_logs: selectedLogIds,
      model: settings.ai_model,
      session_name: currentSessionId ? undefined : pendingSessionName,
      reasoning: isReasoningEnabled,
    });

    if (selectedLogIds.length > 0) {
      clearSelection();
    }
  };

  const handleRename = async () => {
    if (!editedTitle.trim()) {
      return;
    }

    if (currentSessionId && activeWorkspace?.id) {
      await renameSession(currentSessionId, editedTitle, activeWorkspace.id);
    } else {
      setPendingSessionName(editedTitle);
    }
    setIsEditingTitle(false);
  };

  const handleNewSession = () => {
    setSession(null);
    setPendingSessionName(generateDefaultName());
    setIsEditingTitle(false);
  };

  const isResizing = useRef(false);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing.current) {
        return;
      }
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 320 && newWidth < 800) {
        setSidebarWidth(newWidth);
      }
    },
    [setSidebarWidth],
  );

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
    document.body.style.cursor = "default";
  }, [handleMouseMove]);

  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize";
  }, [handleMouseMove, stopResizing]);

  if (!isSidebarOpen) {
    return null;
  }

  return (
    <div
      className="flex flex-col border-l border-border-subtle bg-bg-app h-full relative shrink-0 overflow-hidden"
      style={{
        width: `${sidebarWidth}px`,
        minWidth: `${sidebarWidth}px`,
        maxWidth: `${sidebarWidth}px`,
      }}
    >
      {/* Resize Handle */}
      <Button
        variant="ghost"
        aria-label="Resize Sidebar"
        onMouseDown={startResizing}
        className="absolute left-[-2px] top-0 w-[4px] h-full cursor-col-resize hover:bg-emerald-500/50 transition-colors z-[100] border-none bg-transparent block p-0"
      />

      <div className="p-4 border-b border-border-subtle flex items-center justify-between shrink-0 h-[65px]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-violet-500/10 p-2 rounded-xl shrink-0">
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <div className="min-w-0">
            {isEditingTitle ? (
              <input
                className="bg-bg-surface border border-primary/30 rounded px-2 py-0.5 text-sm font-bold text-text-primary focus:outline-none w-full"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRename();
                  }
                  if (e.key === "Escape") {
                    setIsEditingTitle(false);
                  }
                }}
              />
            ) : (
              <Button
                variant="ghost"
                className="flex items-center gap-2 group/title cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50 rounded bg-transparent p-0 border-none text-left h-auto"
                onClick={() => setIsEditingTitle(true)}
              >
                <h2 className="text-sm font-bold text-text-primary leading-tight truncate">
                  {displayTitle}
                </h2>
                <Pencil className="h-3 w-3 text-text-muted opacity-0 group-hover/title:opacity-100 transition-opacity hover:text-primary" />
              </Button>
            )}
            <p className="text-xs text-text-muted uppercase tracking-widest opacity-60 font-medium">
              {currentSessionId ? "Active Session" : "New Investigation"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-text-muted hover:text-primary hover:bg-primary/10"
            onClick={handleNewSession}
            title="New Investigation"
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 space-y-8">
          {messages.length === 0 ? (
            <div className="space-y-12">
              <div className="flex flex-col items-center justify-center pt-10 text-center space-y-4">
                <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center text-primary/20 border border-primary/10">
                  <MessageSquare className="size-8" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-text-primary">AI Investigator Ready</h4>
                  <p className="text-xs text-text-muted mt-2 px-10 leading-relaxed max-w-sm mx-auto">
                    Select logs to start a context-aware analysis or resume a previous investigation.
                  </p>
                </div>
              </div>

              {sessions.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">
                      Recent Investigations
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {sessions.slice(0, 4).map((s) => (
                      <Button
                        key={s.session_id}
                        variant="ghost"
                        onClick={() => setSession(s.session_id)}
                        className="flex flex-col items-start p-4 text-left bg-bg-surface-bright/40 border border-border-subtle rounded-2xl hover:border-primary/30 hover:bg-primary/[0.02] transition-all group h-auto w-full"
                      >
                        <span className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors mb-1 truncate w-full">
                          {s.name}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(s.last_modified).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>Investigation</span>
                        </div>
                      </Button>
                    ))}
                  </div>

                  {sessions.length > 4 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSearchModalOpen(true)}
                      className="w-full mt-2 text-xs font-bold text-text-muted uppercase tracking-widest hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                    >
                      Show {sessions.length - 4} more...
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            messages.map((m, index) => (
              <AIMessageRow
                key={m.id}
                message={m}
                prevMessage={index > 0 ? messages[index - 1] : null}
                isLoading={isLoading}
                isLastMessage={index === messages.length - 1}
                onA2UIAction={handleA2UIAction}
              />
            ))
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <SidebarInputBar
        isLoading={isLoading}
        selectedLogIds={selectedLogIds}
        currentProvider={settings.ai_provider}
        currentModel={settings.ai_model}
        isFetchingModels={isFetchingModels}
        verifiedProviders={verifiedProviders}
        providerModelsCache={providerModelsCache}
        providerConfigs={{
          ollamaHost: settings.ai_ollama_host,
          openaiKey: settings.ai_openai_api_key,
          geminiKey: settings.ai_gemini_api_key,
          openrouterKey: settings.ai_openrouter_api_key,
          openaiCompatKey: settings.ai_openai_compat_api_key,
          openaiHost: settings.ai_openai_host,
          lmstudioHost: settings.ai_lmstudio_host,
        }}
        isReasoningEnabled={isReasoningEnabled}
        onToggleReasoning={() => setIsReasoningEnabled(!isReasoningEnabled)}
        onFetchModels={fetchModels}
        onProviderChange={handleProviderChange}
        onModelChange={handleModelChange}
        onClearSelection={clearSelection}
        onSendMessage={handleSendMessage}
        onStopStream={stopStream}
      />

      <AIHistorySearchModal open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen} />
    </div>
  );
}
