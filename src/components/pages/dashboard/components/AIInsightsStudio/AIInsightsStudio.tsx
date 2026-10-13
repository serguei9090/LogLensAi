import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { useAiStore } from "@/store/aiStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUIStore } from "@/store/uiStore";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { QuickPromptStarters } from "./QuickPromptStarters";
import { StudioDiagramHelperModal } from "./StudioDiagramHelperModal";
import { StudioFloatingControls } from "./StudioFloatingControls";
import { StudioMessageCard } from "./StudioMessageCard";
import { StudioPromptInput } from "./StudioPromptInput";

export function AIInsightsStudio() {
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const activeWorkspaceId = activeWorkspace?.id ?? "default";
  const { setActiveNav } = useUIStore();
  const { setSearchQuery, setFilters } = useInvestigationStore();

  const {
    dashboardSessionId,
    dashboardSessions,
    dashboardMessages,
    isDashboardLoading,
    setDashboardSession,
    fetchSessions,
    deleteSession,
    sendMessage,
    stopStream,
  } = useAiStore();

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

  const [isReasoningEnabled, setIsReasoningEnabled] = useState(true);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [activeCatalogScopes, setActiveCatalogScopes] = useState<
    { id: string; name: string; workspaceName?: string }[]
  >([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActive);

  // Auto-scroll on incoming stream chunks
  // biome-ignore lint/correctness/useExhaustiveDependencies: Scroll triggers on messages or loading state change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [dashboardMessages, isDashboardLoading]);

  // Load dashboard sessions on mount
  useEffect(() => {
    fetchSessions(activeWorkspaceId);
  }, [activeWorkspaceId, fetchSessions]);

  const fetchModels = useCallback(
    async (forceRefresh = false, targetProvider?: string) => {
      const activeProvider = targetProvider || settings.ai_provider || "openrouter";
      setIsFetchingModels(true);
      try {
        const result = await callSidecar<{ models: string[]; verified?: boolean }>({
          method: "get_ai_models",
          params: { provider: activeProvider, force_refresh: forceRefresh },
        });
        if (result?.models) {
          setProviderCachedModels(activeProvider, result.models);
          if (result.verified) {
            markProviderVerified(activeProvider);
          }
        }
      } catch (e) {
        console.warn(`[Studio] Failed to load models for ${activeProvider}:`, e);
      } finally {
        setIsFetchingModels(false);
      }
    },
    [settings.ai_provider, setProviderCachedModels, markProviderVerified],
  );

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleProviderChange = (provider: string) => {
    updateSettings({ ai_provider: provider });
    flushPendingSettings();
    fetchModels(false, provider);
  };

  const handleModelChange = (model: string) => {
    updateSettings({ ai_model: model });
    flushPendingSettings();
  };

  const handleSendMessage = (text: string) => {
    let finalMessage = text;
    if (activeCatalogScopes.length > 0) {
      const scopesDesc = activeCatalogScopes
        .map((s) => `${s.name} (source_id: "${s.id}")`)
        .join(", ");
      finalMessage = `[TARGET CATALOGS: ${scopesDesc}] ${text}`;
      // Auto-unselect context after sending so subsequent messages start fresh
      setActiveCatalogScopes([]);
    }

    sendMessage({
      workspace_id: activeWorkspaceId,
      message: finalMessage,
      model: settings.ai_model || undefined,
      reasoning: isReasoningEnabled,
      session_type: "dashboard",
    });
  };

  const handleNewSession = () => {
    setDashboardSession(null);
  };

  const handleDeleteSession = (id: string) => {
    deleteSession(id, activeWorkspaceId);
  };

  const handleA2UIAction = useCallback(
    (action: unknown) => {
      if (!action || typeof action !== "object") {
        return;
      }
      const act = action as Record<string, unknown>;
      if (act.type === "filter") {
        if (typeof act.query === "string") {
          setSearchQuery(act.query);
        }
        if (typeof act.level === "string") {
          setFilters([
            {
              id: "lvl-filter",
              field: "level",
              operator: "equals",
              value: act.level,
            },
          ]);
        }
        setActiveNav("investigation");
      } else if (act.type === "query" && typeof act.query === "string") {
        setSearchQuery(act.query);
        setActiveNav("investigation");
      }
    },
    [setActiveNav, setSearchQuery, setFilters],
  );

  return (
    <div className="flex flex-col h-full w-full bg-bg-app border border-border/50 rounded-2xl overflow-hidden relative shadow-2xl animate-fade-in-up">
      {/* Studio Top-Left Floating Diagrams / Visuals Blueprint Button */}
      <StudioDiagramHelperModal onSelectPrompt={handleSendMessage} />

      {/* Studio Floating Top Controls (History + New Chat) */}
      <StudioFloatingControls
        sessions={dashboardSessions}
        currentSessionId={dashboardSessionId}
        onSelectSession={setDashboardSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
      />

      {/* Studio Conversational Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-16 pb-36">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          {dashboardMessages.length === 0 ? (
            <QuickPromptStarters onSelectPrompt={handleSendMessage} />
          ) : (
            dashboardMessages.map((msg, index) => {
              const isLast = index === dashboardMessages.length - 1;
              const isAssistant = msg.role === "assistant";
              return (
                <StudioMessageCard
                  key={msg.id || index}
                  isUser={msg.role === "user"}
                  showTypingIndicator={isAssistant && isLast && isDashboardLoading && !msg.content}
                  thinking={null}
                  isPulseActive={false}
                  isStreaming={isAssistant && isLast && isDashboardLoading}
                  content={msg.content}
                  response={msg.content}
                  a2uiPayload={msg.a2ui_payload}
                  evaluationNotice={msg.evaluation_notice}
                  steps={msg.steps}
                  onA2UIAction={handleA2UIAction}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Studio Prompt Input */}
      <StudioPromptInput
        isLoading={isDashboardLoading}
        currentProvider={settings.ai_provider || "openrouter"}
        currentModel={settings.ai_model || ""}
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
        workspaces={workspaces}
        currentWorkspaceId={activeWorkspaceId}
        activeCatalogScopes={activeCatalogScopes}
        onSetCatalogScopes={setActiveCatalogScopes}
        onSwitchWorkspace={setActiveWorkspace}
        onToggleReasoning={() => setIsReasoningEnabled(!isReasoningEnabled)}
        onFetchModels={fetchModels}
        onProviderChange={handleProviderChange}
        onModelChange={handleModelChange}
        onSendMessage={handleSendMessage}
        onStopStream={stopStream}
      />
    </div>
  );
}
