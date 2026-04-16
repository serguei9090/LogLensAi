import { MarkdownContent } from "@/components/atoms/MarkdownContent";
import { ThinkingBlock } from "@/components/atoms/ThinkingBlock";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Extracts <think>...</think> blocks from model responses.
 * Returns the thinking content and the clean response separately,
 * and handles unclosed tags during active streaming.
 */
function parseThinking(content: string): {
  thinking: string | null;
  response: string;
  isStreamingThink: boolean;
} {
  if (!content) return { thinking: null, response: "", isStreamingThink: false };

  // 1. Check for fully closed think block
  const closedMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  if (closedMatch) {
    const rawResponse = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return {
      thinking: closedMatch[1].trim(),
      response: rawResponse,
      isStreamingThink: false,
    };
  }

  // 2. Check for active unclosed think block (streaming)
  const openTagIndex = content.indexOf("<think>");
  if (openTagIndex !== -1) {
    const thinkingPart = content.substring(openTagIndex + 7);
    const responsePart = content.substring(0, openTagIndex).trim();

    // If it started <think> but hasn't closed, we are streaming thinking
    return {
      thinking: thinkingPart,
      response: responsePart,
      isStreamingThink: true,
    };
  }

  // 3. Check for partial start tag at the very end of content (e.g. "blabla <thi")
  // This prevents the tag itself from being rendered as text during the split second it's arriving
  const partialTagMatch = content.match(/<t(h(i(n(k)?)?)?)?$/i);
  if (partialTagMatch) {
    return {
      thinking: "",
      response: content.substring(0, partialTagMatch.index).trim(),
      isStreamingThink: true,
    };
  }

  return { thinking: null, response: content, isStreamingThink: false };
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
    deleteSession,
    sendMessage,
    isLoading,
  } = useAiStore();

  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const { settings, fetchSettings } = useSettingsStore();
  const { selectedLogIds, clearSelection } = useInvestigationStore();

  const [inputValue, setInputValue] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [pendingSessionName, setPendingSessionName] = useState("");
  const [showCommands, setShowCommands] = useState(false);
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: Auto-scroll when messages update
  }, [messages.length]);

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

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center p-0 h-8 w-8 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/80 transition-colors">
              <Clock className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[280px] bg-[#111312] border-zinc-800/80 p-1"
            >
              <ScrollArea className="h-[400px]">
                <div className="p-2">
                  <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2 pl-2">
                    Investigation History
                  </h3>
                  {sessions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-500 italic">
                      No sessions yet
                    </div>
                  ) : (
                    sessions.map((s) => (
                      <div key={s.session_id} className="relative group">
                        <DropdownMenuItem
                          onClick={() => setSession(s.session_id)}
                          className={cn(
                            "flex flex-col items-start gap-1 p-3 focus:bg-zinc-800/60 transition-all mb-1 rounded-xl",
                            currentSessionId === s.session_id &&
                              "bg-emerald-500/5 border-l-2 border-emerald-500",
                          )}
                        >
                          <span className="font-bold text-xs truncate w-full text-zinc-200">
                            {s.name}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {new Date(s.last_modified).toLocaleString()}
                          </span>
                        </DropdownMenuItem>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeWorkspace?.id) {
                              deleteSession(s.session_id, activeWorkspace.id);
                            }
                          }}
                          className="absolute top-3 right-2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg transition-all"
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

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

              // Hide the empty placeholder bubble if we are still 'isLoading' and it's the tip of the stream
              if (isAssistantAndEmpty && isLoading && index === messages.length - 1) {
                return null;
              }

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
                        isAssistantAndEmpty &&
                          !isUser &&
                          "bg-transparent border-transparent px-0 py-0 shadow-none opactiy-0",
                      )}
                      style={{ overflowWrap: "anywhere" }}
                    >
                      {(thinking !== null || isStreamingThink) && (
                        <ThinkingBlock content={thinking ?? ""} isStreaming={isStreamingThink} />
                      )}
                      {isUser ? (
                        <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere">
                          {response}
                        </p>
                      ) : response ? (
                        <MarkdownContent
                          content={response}
                          className="text-zinc-200 selection:bg-emerald-500/30"
                        />
                      ) : null}
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
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-4 mt-6">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-500/10 border border-violet-500/20">
                <Bot className="size-4 text-violet-400 animate-pulse" />
              </div>
              <div className="bg-[#111312] border border-zinc-800/60 px-5 py-3 rounded-2xl rounded-tl-none shadow-sm">
                <div className="flex gap-1.5 items-center">
                  <div className="size-1.5 bg-violet-400/50 rounded-full animate-bounce" />
                  <div className="size-1.5 bg-violet-400/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="size-1.5 bg-violet-400/50 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
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

        <div className="flex justify-between items-center opacity-40 px-1">
          <span className="text-[9px] text-zinc-500 font-medium tracking-tight uppercase">
            LogLens Platform Agent 2.0
          </span>
          <div className="flex gap-2">
            <IconButton
              icon={<Trash2 className="size-3" />}
              label="Clear Conversation"
              onClick={() => {}}
              className="size-6 bg-transparent hover:bg-red-500/10 hover:text-red-400 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  className,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-lg hover:bg-zinc-800/80 transition-colors h-8 w-8",
        className,
      )}
      onClick={onClick}
      title={label}
    >
      {icon}
    </button>
  );
}
