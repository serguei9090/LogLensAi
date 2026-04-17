import { MarkdownContent } from "@/components/atoms/MarkdownContent";
import { ThinkingBlock } from "@/components/atoms/ThinkingBlock";
import { AIHistorySearchModal } from "@/components/organisms/AIHistorySearchModal";
import { Button } from "@/components/ui/button";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAiStore } from "@/store/aiStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import {
  Bot,
  Clock,
  Lightbulb,
  LightbulbOff,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

/** Raw channel markers emitted by Gemma4 models that should never appear in UI. */
const CHANNEL_TAGS = ["<|channel>thought", "<|channel>text", "<channel|>", "<|think|>"] as const;

/** Strip all known raw channel markers from a string. */
function stripChannelTags(text: string): string {
  let result = text;
  for (const tag of CHANNEL_TAGS) {
    result = result.replaceAll(tag, "");
  }
  return result;
}

export function parseThinking(content: string): {
  thinking: string | null;
  response: string;
  isStreamingThink: boolean;
} {
  if (!content) {
    return { thinking: null, response: "", isStreamingThink: false };
  }

  const startTags = ["<think>", "<|channel>thought"];
  const endTags = ["</think>", "<|channel>text", "<channel|>"];

  // 1. Find the FIRST start tag
  let firstStartIdx = -1;
  let startTagLength = 0;
  for (const tag of startTags) {
    const idx = content.indexOf(tag);
    if (idx !== -1 && (firstStartIdx === -1 || idx < firstStartIdx)) {
      firstStartIdx = idx;
      startTagLength = tag.length;
    }
  }

  // 2. Find the FIRST end tag that appears AFTER the start tag
  let firstEndIdx = -1;
  let endTagLength = 0;
  for (const tag of endTags) {
    const searchStart = firstStartIdx !== -1 ? firstStartIdx + startTagLength : 0;
    const idx = content.indexOf(tag, searchStart);
    if (idx !== -1 && (firstEndIdx === -1 || idx < firstEndIdx)) {
      firstEndIdx = idx;
      endTagLength = tag.length;
    }
  }

  // 3. Phase: Terminal (Found transition)
  if (firstEndIdx !== -1) {
    let thinking = "";
    if (firstStartIdx !== -1) {
      thinking = content.substring(firstStartIdx + startTagLength, firstEndIdx);
    } else {
      thinking = content.substring(0, firstEndIdx);
    }

    let response = content.substring(firstEndIdx + endTagLength);

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
      response: response.trim(),
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

  // 5. No thinking tags found — strip any leaked channel markers from plain response
  return { thinking: null, response: stripChannelTags(content), isStreamingThink: false };
}

export function AIInvestigationSidebar() {
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
    isLoading,
  } = useAiStore();

  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const { settings, fetchSettings } = useSettingsStore();
  const { selectedLogIds, clearSelection } = useInvestigationStore();

  const [inputValue, setInputValue] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [pendingSessionName, setPendingSessionName] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [isReasoningEnabled, setIsReasoningEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  ];

  const generateDefaultName = useCallback(() => {
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `LOG-${rand}`;
  }, []);

  const currentSession = sessions.find((s) => s.session_id === currentSessionId);
  const displayTitle = currentSession?.name || pendingSessionName || "Investigation Hub";

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchSessions(activeWorkspace.id);
    }
    fetchSettings();
  }, [activeWorkspace?.id, fetchSessions, fetchSettings]);

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
  }, [messages.length, messages[messages.length - 1]?.content]);

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
      className="flex flex-col border-l border-zinc-800/60 bg-[#0D0F0E] h-full relative shrink-0 overflow-hidden"
      style={{
        width: `${sidebarWidth}px`,
        minWidth: `${sidebarWidth}px`,
        maxWidth: `${sidebarWidth}px`,
      }}
    >
      {/* Resize Handle */}
      <button
        type="button"
        aria-label="Resize Sidebar"
        onMouseDown={startResizing}
        className="absolute left-[-2px] top-0 w-[4px] h-full cursor-col-resize hover:bg-emerald-500/50 transition-colors z-[100] border-none bg-transparent block p-0"
      />

      <div className="p-4 border-b border-zinc-800/60 flex items-center justify-between shrink-0 h-[65px]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-violet-500/10 p-2 rounded-xl shrink-0">
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <div className="min-w-0">
            {isEditingTitle ? (
              <input
                className="bg-zinc-900 border border-emerald-500/30 rounded px-2 py-0.5 text-[13px] font-bold text-white focus:outline-none w-full"
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
              <button
                type="button"
                className="flex items-center gap-2 group/title cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50 rounded bg-transparent p-0 border-none text-left"
                onClick={() => setIsEditingTitle(true)}
              >
                <h2 className="text-sm font-bold text-white leading-tight truncate">
                  {displayTitle}
                </h2>
                <Pencil className="h-3 w-3 text-zinc-500 opacity-0 group-hover/title:opacity-100 transition-opacity hover:text-emerald-400" />
              </button>
            )}
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest opacity-60 font-medium">
              {currentSessionId ? "Active Session" : "New Investigation"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10"
            onClick={handleNewSession}
            title="New Investigation"
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/80"
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
                <div className="w-16 h-16 bg-emerald-500/5 rounded-full flex items-center justify-center text-emerald-500/20 border border-emerald-500/10">
                  <MessageSquare className="size-8" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-zinc-100">AI Investigator Ready</h4>
                  <p className="text-xs text-zinc-500 mt-2 px-10 leading-relaxed max-w-sm mx-auto">
                    Select logs to start a context-aware analysis or resume a previous
                    investigation.
                  </p>
                </div>
              </div>

              {sessions.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Recent Investigations
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {sessions.slice(0, 4).map((s) => (
                      <button
                        key={s.session_id}
                        type="button"
                        onClick={() => setSession(s.session_id)}
                        className="flex flex-col items-start p-4 text-left bg-zinc-900/40 border border-zinc-800/60 rounded-2xl hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all group"
                      >
                        <span className="text-xs font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors mb-1 truncate w-full">
                          {s.name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(s.last_modified).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>Investigation</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {sessions.length > 4 && (
                    <button
                      type="button"
                      onClick={() => setIsSearchModalOpen(true)}
                      className="w-full mt-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest hover:text-emerald-400 hover:bg-emerald-400/5 rounded-lg transition-all"
                    >
                      Show {sessions.length - 4} more...
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            messages.map((m, index) => {
              const isUser = m.role === "user";
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const isSameRoleAsPrev = prevMessage?.role === m.role;

              const { thinking, response, isStreamingThink } = isUser
                ? { thinking: null, response: m.content, isStreamingThink: false }
                : parseThinking(m.content);

              const isAssistantAndEmpty = !isUser && !thinking && !response;

              // If assistant is empty and we're loading, show the typing indicator
              const showTypingIndicator =
                isAssistantAndEmpty && isLoading && index === messages.length - 1;

              // Only hold the 'streaming' pulse state if the global store is actually still loading
              const isPulseActive = isStreamingThink && isLoading && index === messages.length - 1;

              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex gap-3 group",
                    isUser ? "flex-row-reverse" : "flex-row",
                    isSameRoleAsPrev ? "mt-1" : "mt-6",
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border transition-transform group-hover:scale-105",
                      isUser
                        ? "bg-zinc-900 border-zinc-800"
                        : "bg-violet-500/10 border-violet-500/20",
                      isSameRoleAsPrev && "opacity-0 pointer-events-none", // Hide redundant avatars
                    )}
                  >
                    {isUser ? (
                      <User className="size-4 text-zinc-400" />
                    ) : (
                      <Bot className="size-4 text-violet-400" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "flex flex-col min-w-0 space-y-2 overflow-hidden",
                      isUser ? "items-end max-w-[85%]" : "items-start max-w-[90%]",
                    )}
                  >
                    {m.context_logs && m.context_logs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        <span className="bg-emerald-500/10 px-2 py-0.5 rounded text-[9px] text-emerald-400 border border-emerald-500/20 font-medium">
                          {m.context_logs.length} logs attached
                        </span>
                      </div>
                    )}
                    <div
                      className={cn(
                        "px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm overflow-hidden w-full break-words transition-all duration-300",
                        isUser
                          ? "bg-zinc-800 text-zinc-100 border border-zinc-700/50 rounded-tr-none"
                          : "bg-[#111312] text-zinc-300 border border-zinc-800/60 rounded-tl-none",
                      )}
                    >
                      {showTypingIndicator ? (
                        <div className="flex items-center gap-3">
                          <TypingIndicator />
                          <span className="text-[11px] font-medium text-zinc-500 animate-pulse lowercase">
                            thinking…
                          </span>
                        </div>
                      ) : (
                        <>
                          {!isUser && (thinking !== null || isPulseActive) && (
                            <ThinkingBlock content={thinking ?? ""} isStreaming={isPulseActive} />
                          )}
                          <div
                            className={cn(
                              "prose prose-invert prose-sm max-w-none",
                              isUser && "text-right",
                            )}
                          >
                            {isUser ? (
                              <p className="whitespace-pre-wrap">{m.content}</p>
                            ) : (
                              <MarkdownContent content={response} className="text-zinc-200" />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    {!isSameRoleAsPrev && (
                      <span className="text-[9px] text-zinc-600 font-medium px-1 tracking-tight">
                        {new Date(m.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-4 bg-[#0d0f0e]/50 backdrop-blur-md border-t border-zinc-800/60 space-y-4 shrink-0">
        {selectedLogIds.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
            <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest">
              Context: {selectedLogIds.length} logs
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors font-bold decoration-dotted underline underline-offset-2"
            >
              Clear Selection
            </button>
          </div>
        )}

        <div className="relative group/input">
          {showCommands && (
            <div className="absolute bottom-full left-0 mb-2 w-full bg-[#111312] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
              <div className="p-2 space-y-1">
                {AI_COMMANDS.filter((c) => c.cmd.startsWith(inputValue.toLowerCase())).map(
                  (cmd) => (
                    <button
                      key={cmd.cmd}
                      type="button"
                      className="w-full flex flex-col items-start px-3 py-2 text-left rounded-lg bg-transparent hover:bg-emerald-500/10 focus:bg-emerald-500/10 outline-none transition-colors group"
                      onClick={() => {
                        setInputValue(`${cmd.cmd} `);
                        setShowCommands(false);
                        textareaRef.current?.focus();
                      }}
                    >
                      <span className="text-xs font-bold text-emerald-400 font-mono">
                        {cmd.cmd}
                      </span>
                      <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 mt-0.5">
                        {cmd.desc}
                      </span>
                    </button>
                  ),
                )}
              </div>
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
            className="min-h-[72px] max-h-[300px] bg-zinc-900/50 border-zinc-800 rounded-2xl resize-none py-3 pr-12 focus:ring-emerald-500/20 text-zinc-100 placeholder:text-zinc-600 transition-all focus:border-emerald-500/30"
          />
          <Button
            size="icon"
            className={cn(
              "absolute bottom-3 right-3 rounded-xl transition-all shadow-lg",
              inputValue.trim()
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-zinc-800 text-zinc-600 opacity-50",
            )}
            disabled={!inputValue.trim() || isLoading}
            onClick={handleSend}
          >
            <Send className="size-4" />
          </Button>
        </div>

        <div className="flex items-center px-1">
          <button
            type="button"
            onClick={() => setIsReasoningEnabled(!isReasoningEnabled)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border",
              isReasoningEnabled
                ? "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20 shadow-[0_0_15px_-5px_rgba(245,158,11,0.4)]"
                : "bg-transparent border-zinc-800/60 text-zinc-500 hover:bg-zinc-800/80",
            )}
            title={isReasoningEnabled ? "Deep Reasoning Active" : "Deep Reasoning Disabled"}
          >
            {isReasoningEnabled ? (
              <Lightbulb className="size-3.5 text-amber-400 animate-pulse-slow" />
            ) : (
              <LightbulbOff className="size-3.5" />
            )}
            <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
              Think
            </span>
          </button>
        </div>
      </div>
      <AIHistorySearchModal open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen} />
    </div>
  );
}
