import { MarkdownContent } from "@/components/atoms/MarkdownContent";
import { ThinkingBlock } from "@/components/atoms/ThinkingBlock";
import { AIHistorySearchModal } from "@/components/organisms/AIHistorySearchModal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import { useAiStore } from "@/store/aiStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUIStore } from "@/store/uiStore";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import {
  Bot,
  Check,
  ChevronDown,
  Clock,
  Copy,
  FileText,
  Lightbulb,
  LightbulbOff,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Square,
  User,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { A2UIRenderer } from "../atoms/A2UIRenderer";
import { TypingIndicator } from "../atoms/TypingIndicator";

/**
 * Extracts <think>...</think> blocks from model responses.
 * Returns the thinking content and the clean response separately,
 * and handles unclosed tags during active streaming.
 *
 * Also defensively strips raw Gemma4 channel markers
 * (`<|channel>thought`, `<|channel>text`, `<channel|>`) that may
 * leak from corrupted DB history or incomplete backend parsing.
 */

import type { FilterEntry } from "../molecules/FilterBuilder";

/** Raw channel markers emitted by Gemma4 models that should never appear in UI. */
const CHANNEL_TAGS = [
  "<|channel>thought",
  "<|channel|>thought",
  "<|channel>text",
  "<|channel|>text",
  "<channel|>",
  "<|think|>",
  "<|thought|>",
  "<|text|>",
] as const;

/** Strip all known raw channel markers from a string. */
function stripChannelTags(text: string): string {
  let result = text;
  for (const tag of CHANNEL_TAGS) {
    result = result.replaceAll(tag, "");
  }
  return result;
}

const A2UI_REGEX = /\[\[A2UI\]\].*?(\[\[\/A2UI\]\]|$)/gs;

/** Strip A2UI v0.9 tags from display text. */
function stripA2UITags(text: string): string {
  return text.replaceAll(A2UI_REGEX, "").trim();
}

function findFirstTagIndex(
  content: string,
  tags: readonly string[],
  startSearchFrom = 0,
): { index: number; length: number } {
  let firstIdx = -1;
  let tagLen = 0;
  for (const tag of tags) {
    const idx = content.indexOf(tag, startSearchFrom);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
      tagLen = tag.length;
    }
  }
  return { index: firstIdx, length: tagLen };
}

export function parseThinking(content: string): {
  thinking: string | null;
  response: string;
  isStreamingThink: boolean;
} {
  if (!content) {
    return { thinking: null, response: "", isStreamingThink: false };
  }

  const startTags = [
    "<think>",
    "<|channel>thought",
    "<|channel|>thought",
    "<|thought|>",
    "[reasoning]",
  ];
  const endTags = [
    "</think>",
    "<|channel>text",
    "<|channel|>text",
    "<channel|>",
    "<|text|>",
    "[/reasoning]",
  ];

  // 1. Find the FIRST start tag
  const { index: firstStartIdx, length: startTagLength } = findFirstTagIndex(content, startTags);

  // 2. Find the FIRST end tag that appears AFTER the start tag
  const searchStart = firstStartIdx === -1 ? 0 : firstStartIdx + startTagLength;
  const { index: firstEndIdx, length: endTagLength } = findFirstTagIndex(
    content,
    endTags,
    searchStart,
  );

  // 3. Phase: Terminal (Found transition)
  if (firstEndIdx !== -1) {
    const prefix = firstStartIdx === -1 ? "" : content.substring(0, firstStartIdx);
    let thinking = "";
    if (firstStartIdx === -1) {
      thinking = content.substring(0, firstEndIdx);
    } else {
      thinking = content.substring(firstStartIdx + startTagLength, firstEndIdx);
    }

    let response = prefix + content.substring(firstEndIdx + endTagLength);

    // Clean all tags from both thinking and response to prevent technical leakage
    thinking = stripChannelTags(thinking);
    response = stripChannelTags(response);

    // Also strip any remaining structural tags
    for (const tag of [...startTags, ...endTags]) {
      response = response.replaceAll(tag, "");
      thinking = thinking.replaceAll(tag, "");
    }

    return {
      thinking: thinking.trim() || null,
      response: stripA2UITags(response.trim()),
      isStreamingThink: false,
    };
  }

  // 4. Phase: Active (Inside thinking)
  if (firstStartIdx !== -1) {
    let thinkingContent = content.substring(firstStartIdx + startTagLength);
    // Strip channel markers from active thinking content
    thinkingContent = stripChannelTags(thinkingContent);

    return {
      thinking: thinkingContent,
      response: content.substring(0, firstStartIdx).trim(),
      isStreamingThink: true,
    };
  }

  // 5. No thinking tags found — strip any leaked channel markers and A2UI tags from plain response
  return {
    thinking: null,
    response: stripA2UITags(stripChannelTags(content)),
    isStreamingThink: false,
  };
}

interface AIMessageRowProps {
  readonly message: {
    id: string | number;
    role: string;
    content: string;
    timestamp: string | number | Date;
    context_logs?: (string | number)[] | null;
    a2ui_payload?: any;
    laya_routed?: boolean;
    laya_intent?: string;
    evaluation_notice?: string;
    steps?: { title: string; done?: boolean }[];
  };
  readonly prevMessage: { role: string } | null;
  readonly isLoading: boolean;
  readonly isLastMessage: boolean;
  readonly onA2UIAction: (action: unknown) => void;
}

interface MessageContentBubbleProps {
  readonly isUser: boolean;
  readonly showTypingIndicator: boolean;
  readonly thinking: string | null;
  readonly isPulseActive: boolean;
  readonly isStreaming: boolean;
  readonly content: string;
  readonly response: string;
  readonly a2uiPayload?: any;
  readonly evaluationNotice?: string;
  readonly steps?: { title: string; done?: boolean }[];
  readonly onA2UIAction: (action: unknown) => void;
}

function MessageContentBubble({
  isUser,
  showTypingIndicator,
  thinking,
  isPulseActive,
  isStreaming,
  content,
  response,
  a2uiPayload,
  evaluationNotice,
  steps,
  onA2UIAction,
}: Readonly<MessageContentBubbleProps>) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(isUser ? content : response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm overflow-hidden w-full break-words transition-all duration-300 relative group/bubble",
        isUser
          ? "bg-bg-surface text-text-primary border border-border-subtle rounded-tr-none"
          : "bg-bg-app text-text-secondary border border-border-subtle rounded-tl-none",
      )}
    >
      {/* Floating Copy Action on Hover */}
      {!showTypingIndicator && (
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2.5 right-2.5 opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1.5 rounded-lg bg-bg-surface/80 hover:bg-bg-surface border border-border-subtle text-text-muted hover:text-text-primary shadow-sm"
          title="Copy text"
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
        </button>
      )}

      {showTypingIndicator ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <TypingIndicator />
            <span className="text-[11px] font-medium text-zinc-500 animate-pulse lowercase">
              {steps && steps.length > 0 ? "investigating…" : "thinking…"}
            </span>
          </div>
          {evaluationNotice && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 w-fit animate-in fade-in">
              <Sparkles className="size-2.5 text-amber-400 animate-spin" />
              <span>{evaluationNotice}</span>
            </div>
          )}
          {steps && steps.length > 0 && (
            <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-bg-surface/50 border border-border-subtle/80 text-[11px]">
              <div className="flex items-center gap-1.5 font-medium text-text-muted mb-0.5 px-1">
                <Wrench className="size-3 text-emerald-400" />
                <span>
                  Execution Steps ({steps.filter((s) => s.done).length}/{steps.length})
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {steps.map((st, idx) => (
                  <div
                    key={`${st.title}-${idx}`}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded-md transition-colors",
                      st.done
                        ? "text-text-secondary bg-emerald-500/5 border border-emerald-500/10"
                        : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-medium",
                    )}
                  >
                    {st.done ? (
                      <Check className="size-3 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Loader2 className="size-3 text-emerald-400 animate-spin flex-shrink-0" />
                    )}
                    <span className="truncate">{st.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {evaluationNotice && !isUser && (
            <div className="mb-2 flex items-center gap-1.5 text-[10px] text-amber-400/90 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 w-fit">
              <Sparkles className="size-2.5 text-amber-400" />
              <span>{evaluationNotice}</span>
            </div>
          )}
          {!isUser && (thinking !== null || isPulseActive) && (
            <ThinkingBlock content={thinking ?? ""} isStreaming={isPulseActive} />
          )}
          {/* Step-by-step progress cards (Antigravity-style) */}
          {!isUser && steps && steps.length > 0 && (
            <div className="mb-3 flex flex-col gap-1.5 p-2 rounded-xl bg-bg-surface/50 border border-border-subtle/80 text-[11px]">
              <div className="flex items-center gap-1.5 font-medium text-text-muted mb-0.5 px-1">
                <Wrench className="size-3 text-emerald-400" />
                <span>
                  Execution Steps ({steps.filter((s) => s.done).length}/{steps.length})
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {steps.map((st, idx) => (
                  <div
                    key={`${st.title}-${idx}`}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded-md transition-colors",
                      st.done
                        ? "text-text-secondary bg-emerald-500/5 border border-emerald-500/10"
                        : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-medium",
                    )}
                  >
                    {st.done ? (
                      <Check className="size-3 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Loader2 className="size-3 text-emerald-400 animate-spin flex-shrink-0" />
                    )}
                    <span className="truncate">{st.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={cn("prose prose-invert prose-sm max-w-none", isUser && "text-right")}>
            {isUser ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : (
              <>
                <MarkdownContent
                  content={
                    response ||
                    (steps && steps.length > 0
                      ? "Completed multi-step investigation."
                      : "No response content received.")
                  }
                  className="text-text-primary"
                  isStreaming={!isUser && isStreaming}
                />
                {a2uiPayload && <A2UIRenderer payload={a2uiPayload} onAction={onA2UIAction} />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AIMessageRow({
  message,
  prevMessage,
  isLoading,
  isLastMessage,
  onA2UIAction,
}: Readonly<AIMessageRowProps>) {
  const isUser = message.role === "user";
  const isSameRoleAsPrev = prevMessage?.role === message.role;

  const { thinking, response, isStreamingThink } = isUser
    ? { thinking: null, response: message.content, isStreamingThink: false }
    : parseThinking(message.content);

  const isAssistantAndEmpty = !isUser && !thinking && !response;

  // If assistant is empty and we're loading, show the typing indicator
  const showTypingIndicator = isAssistantAndEmpty && isLoading && isLastMessage;

  // Only hold the 'streaming' pulse state if the global store is actually still loading
  const isPulseActive = isStreamingThink && isLoading && isLastMessage;

  return (
    <div
      className={cn(
        "flex gap-3 group",
        isUser ? "flex-row-reverse" : "flex-row",
        isSameRoleAsPrev ? "mt-1" : "mt-6",
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all duration-200 group-hover:scale-105 relative",
          isUser
            ? "bg-bg-surface-bright border-border-subtle"
            : "bg-emerald-500/15 border-emerald-500/30 shadow-[0_0_12px_rgba(34,197,94,0.2)]",
          isSameRoleAsPrev && "opacity-0 pointer-events-none", // Hide redundant avatars
        )}
      >
        {isUser ? (
          <User className="size-4 text-text-muted" />
        ) : (
          <Bot className="size-4 text-emerald-400" />
        )}
      </div>
      <div
        className={cn(
          "flex flex-col min-w-0 space-y-2 overflow-hidden",
          isUser ? "items-end max-w-[85%]" : "items-start max-w-[90%]",
        )}
      >
        {message.context_logs && message.context_logs.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            <span className="bg-primary/10 px-2 py-0.5 rounded text-[9px] text-primary border border-primary/20 font-medium">
              {message.context_logs.length} logs attached
            </span>
          </div>
        )}
        <MessageContentBubble
          isUser={isUser}
          showTypingIndicator={showTypingIndicator}
          thinking={thinking}
          isPulseActive={isPulseActive}
          isStreaming={isLoading && isLastMessage}
          content={message.content}
          response={response}
          a2uiPayload={message.a2ui_payload}
          evaluationNotice={message.evaluation_notice}
          steps={message.steps}
          onA2UIAction={onA2UIAction}
        />
        {/* Active streaming / multi-step investigation indicator */}
        {!isUser && isLoading && isLastMessage && !showTypingIndicator && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium animate-pulse">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Investigating and executing steps…</span>
          </div>
        )}
        {!isSameRoleAsPrev && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[9px] text-text-muted font-medium tracking-tight">
              {(() => {
                const tsStr = String(message.timestamp);
                const safeTs =
                  tsStr && !tsStr.endsWith("Z") && !tsStr.includes("+") && !tsStr.includes("-", 10)
                    ? `${tsStr.replace(" ", "T")}Z`
                    : tsStr;
                return new Date(safeTs).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              })()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function AIInvestigationSidebar({
  onEngineSettingsOpen: _onEngineSettingsOpen,
}: {
  readonly onEngineSettingsOpen?: () => void;
} = {}) {
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

  const [inputValue, setInputValue] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [pendingSessionName, setPendingSessionName] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [isReasoningEnabled, setIsReasoningEnabled] = useState(true);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      case "command": {
        if (a.command) {
          setInputValue(a.command);
          textareaRef.current?.focus();
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

  const AI_COMMANDS = [
    { cmd: "/search", label: "Search Memory", desc: "Search previously saved issues" },
    { cmd: "/save", label: "Save Memory", desc: "Force save the current context as memory" },
    { cmd: "/query", label: "Query Logs", desc: "Search across active workspace logs" },
    {
      cmd: "/analyze",
      label: "Analyze Cluster",
      desc: "Perform deep-dive analysis on a log pattern",
    },
    { cmd: "/anomalies", label: "Find Anomalies", desc: "Scan workspace for statistical outliers" },
    { cmd: "/create_column", label: "Create Column", desc: "Ask AI to create a custom column" },
    {
      cmd: "/create_facet",
      label: "Create Facet",
      desc: "Ask AI to extract a custom facet (mask)",
    },
  ];

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

  // 1. Instant scroll to bottom on session change (Historical Context)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Must trigger on sessionId change, messages.length is used as safety guard.
  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [currentSessionId]);

  // 2. Smooth scroll as new messages arrive or tokens stream in
  // biome-ignore lint/correctness/useExhaustiveDependencies: Tracks token streaming for smooth viewport following.
  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      // Only scroll if we are looking at the bottom or if it's a new message
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, messages.at(-1)?.content]);

  // Handle Send logic...

  const handleSend = async () => {
    if (!inputValue.trim() || !activeWorkspace?.id) {
      return;
    }

    const message = inputValue;
    setInputValue("");

    await sendMessage({
      workspace_id: activeWorkspace.id,
      message,
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
                className="bg-bg-surface border border-primary/30 rounded px-2 py-0.5 text-[13px] font-bold text-text-primary focus:outline-none w-full"
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
            <p className="text-[10px] text-text-muted uppercase tracking-widest opacity-60 font-medium">
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
                    Select logs to start a context-aware analysis or resume a previous
                    investigation.
                  </p>
                </div>
              </div>

              {sessions.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
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
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
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
                      className="w-full mt-2 text-[10px] font-bold text-text-muted uppercase tracking-widest hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
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

      <div className="p-4 bg-bg-app/50 backdrop-blur-md border-t border-border-subtle space-y-3 shrink-0">
        <div className="relative group/input bg-bg-surface-bright/50 border border-border-subtle rounded-2xl focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all p-3 flex flex-col gap-2">
          {showCommands && (
            <div className="absolute bottom-full left-0 mb-2 w-full bg-bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
              <div className="p-2 space-y-1">
                {AI_COMMANDS.filter((c) => c.cmd.startsWith(inputValue.toLowerCase())).map(
                  (cmd) => (
                    <Button
                      key={cmd.cmd}
                      variant="ghost"
                      className="w-full flex flex-col items-start px-3 py-2 text-left rounded-lg bg-transparent hover:bg-primary/10 focus:bg-primary/10 outline-none transition-colors group h-auto"
                      onClick={() => {
                        setInputValue(`${cmd.cmd} `);
                        setShowCommands(false);
                        textareaRef.current?.focus();
                      }}
                    >
                      <span className="text-xs font-bold text-emerald-400 font-mono">
                        {cmd.cmd}
                      </span>
                      <span className="text-[10px] text-text-muted group-hover:text-text-secondary mt-0.5">
                        {cmd.desc}
                      </span>
                    </Button>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Inline Attached Context Tag */}
          {selectedLogIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="cursor-default">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-surface border border-border-subtle text-text-primary text-xs font-medium shadow-sm group/tag select-none hover:border-primary/40 transition-colors">
                      <FileText className="size-3 text-primary shrink-0" />
                      <span className="text-[11px] font-semibold tracking-tight">
                        {selectedLogIds.length} {selectedLogIds.length === 1 ? "log" : "logs"}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearSelection();
                        }}
                        className="ml-1 p-0.5 rounded hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                        title="Remove context"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="text-xs bg-bg-surface border border-border text-text-secondary py-1 px-2.5"
                  >
                    {selectedLogIds.length} {selectedLogIds.length === 1 ? "log" : "logs"} selected
                    as context. Press Backspace to remove.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => {
              const val = e.target.value;
              setInputValue(val);
              if (val.startsWith("/")) {
                setShowCommands(true);
              } else {
                setShowCommands(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && inputValue === "" && selectedLogIds.length > 0) {
                clearSelection();
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                setShowCommands(false);
                handleSend();
              }
              if (e.key === "Escape") {
                setShowCommands(false);
              }
            }}
            placeholder="Search patterns or analyze errors..."
            className="w-full min-h-[56px] max-h-[260px] bg-transparent border-0 rounded-none p-0 focus:ring-0 focus-visible:ring-0 text-text-primary placeholder:text-text-muted transition-all resize-none leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1 border-t border-border-subtle/40">
            <div className="flex items-center gap-1.5 overflow-hidden min-w-0 pr-1">
              {/* VS Code-style Provider & Model Selector Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="h-7 px-2 gap-1.5 text-xs text-text-secondary hover:text-text-primary bg-bg-surface/50 hover:bg-bg-surface border border-border-subtle/60 rounded-lg max-w-[210px] flex items-center justify-between font-normal shrink-0 cursor-pointer outline-none transition-colors"
                  title={`Provider: ${settings.ai_provider} | Model: ${settings.ai_model}`}
                >
                  <span className="truncate text-[11px] font-medium font-mono text-text-primary">
                    {settings.ai_model || "Select Model"}
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
                    <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">
                      AI Providers
                    </span>
                    <button
                      type="button"
                      onClick={() => fetchModels(true)}
                      className="text-[10px] text-primary hover:underline cursor-pointer disabled:opacity-50"
                      disabled={isFetchingModels}
                    >
                      {isFetchingModels ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>

                  <div className="space-y-0.5 mt-1">
                    {[
                      {
                        id: "ollama",
                        name: "Ollama",
                        isConfigured: Boolean(settings.ai_ollama_host?.trim()),
                      },
                      {
                        id: "openai",
                        name: "OpenAI (Official)",
                        isConfigured: Boolean(settings.ai_openai_api_key?.trim()),
                      },
                      {
                        id: "ai-studio",
                        name: "Google AI Studio",
                        isConfigured: Boolean(settings.ai_gemini_api_key?.trim()),
                      },
                      {
                        id: "openrouter",
                        name: "OpenRouter",
                        isConfigured: Boolean(settings.ai_openrouter_api_key?.trim()),
                      },
                      {
                        id: "openai-compatible",
                        name: "OpenAI Compatible",
                        isConfigured: Boolean(
                          settings.ai_openai_host?.trim() ||
                            settings.ai_openai_compat_api_key?.trim(),
                        ),
                      },
                      {
                        id: "lmstudio",
                        name: "LM Studio",
                        isConfigured: Boolean(settings.ai_lmstudio_host?.trim()),
                      },
                    ].map((provider) => {
                      const isActiveProvider = settings.ai_provider === provider.id;
                      // Determine available models for this provider: only verified/pulled models cached for this specific provider
                      const rawModels = providerModelsCache[provider.id] || [];

                      // Filter models if search query is active
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
                            <span className="text-[10px] text-amber-500/60 font-medium">
                              Not configured
                            </span>
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
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-text-secondary hover:text-text-primary hover:bg-white/5",
                            )}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="truncate">{provider.name}</span>
                              {verifiedProviders.includes(provider.id) && (
                                <Check className="size-3 text-emerald-400 shrink-0" />
                              )}
                            </div>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-64 p-1.5 bg-bg-surface border border-border-subtle shadow-2xl rounded-xl z-[130]">
                            <div className="flex items-center justify-between px-2 py-1 select-none border-b border-border-subtle/50 mb-1">
                              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">
                                {provider.name} Models
                              </span>
                              <span className="text-[10px] text-text-muted/60">
                                {rawModels.length}
                              </span>
                            </div>

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
                                  <p className="text-[11px] leading-relaxed">
                                    No models loaded yet. Confirm connection and fetch available
                                    models.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isActiveProvider) {
                                        handleProviderChange(provider.id);
                                      }
                                      fetchModels(true, provider.id);
                                    }}
                                    disabled={isFetchingModels}
                                    className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 cursor-pointer disabled:opacity-50 transition-colors inline-block"
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
                                  const isCurrentModel =
                                    isActiveProvider && settings.ai_model === m;
                                  return (
                                    <DropdownMenuItem
                                      key={m}
                                      onClick={() => {
                                        if (!isActiveProvider) {
                                          handleProviderChange(provider.id);
                                          handleModelChange(m);
                                        } else {
                                          handleModelChange(m);
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

              {/* Thinking Icon-Only Toggle with Tooltip */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    onClick={() => setIsReasoningEnabled(!isReasoningEnabled)}
                    className={cn(
                      "size-7 rounded-lg transition-all border flex items-center justify-center cursor-pointer shrink-0",
                      isReasoningEnabled
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 shadow-[0_0_12px_-3px_rgba(245,158,11,0.5)]"
                        : "bg-transparent border-border-subtle/60 text-text-muted hover:bg-bg-hover hover:text-text-primary",
                    )}
                    aria-label={isReasoningEnabled ? "Thinking on" : "Thinking off"}
                  >
                    {isReasoningEnabled ? (
                      <Lightbulb className="size-3.5 text-amber-400 animate-pulse-slow" />
                    ) : (
                      <LightbulbOff className="size-3.5" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="text-xs bg-bg-surface border border-border text-text-secondary py-1 px-2.5"
                  >
                    {isReasoningEnabled ? "Thinking on" : "Thinking off"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {isLoading ? (
              <Button
                size="icon"
                type="button"
                className="size-7 rounded-lg transition-all shadow-md bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 active:scale-95"
                onClick={stopStream}
                title="Stop generating"
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                type="button"
                className={cn(
                  "size-7 rounded-lg transition-all shadow-md",
                  inputValue.trim()
                    ? "bg-primary hover:bg-primary-hover text-bg-app"
                    : "bg-bg-surface text-text-muted opacity-50",
                )}
                disabled={!inputValue.trim()}
                onClick={handleSend}
                title="Send message"
              >
                <Send className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <AIHistorySearchModal open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen} />
    </div>
  );
}
