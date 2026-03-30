import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAiStore } from "@/store/aiStore";
import { useInvestigationStore } from "@/store/investigationStore";
import { useWorkspaceStore, selectActiveWorkspace } from "@/store/workspaceStore";
import { 
  Sparkles, 
  Send, 
  User, 
  Bot, 
  Trash2, 
  Plus, 
  MessageSquare,
  Clock,
  ChevronDown,
  X
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

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
    sendMessage,
    isLoading 
  } = useAiStore();
  
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const { selectedLogIds, clearSelection } = useInvestigationStore();
  
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchSessions(activeWorkspace.id);
    }
  }, [activeWorkspace?.id, fetchSessions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !activeWorkspace?.id) return;
    
    const message = inputValue;
    setInputValue("");
    
    await sendMessage({
      workspace_id: activeWorkspace.id,
      message,
      context_logs: selectedLogIds,
      model: "gemini-2.0-flash",
    });
    
    if (selectedLogIds.length > 0) {
      clearSelection();
    }
  };

  const handleNewSession = () => {
    setSession(null);
  };

  const isResizing = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 320 && newWidth < 800) {
      setSidebarWidth(newWidth);
    }
  }, [setSidebarWidth]);

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

  if (!isSidebarOpen) return null;

  return (
    <div 
      className="flex flex-col border-l border-zinc-800/60 bg-[#0D0F0E] h-full relative"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={startResizing}
        className="absolute left-[-2px] top-0 w-[4px] h-full cursor-col-resize hover:bg-emerald-500/50 transition-colors z-[100]"
      />

      <div className="p-4 border-b border-zinc-800/60 flex items-center justify-between shrink-0 h-[65px]">
        <div className="flex items-center gap-3">
          <div className="bg-violet-500/10 p-2 rounded-xl">
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">Investigation Hub</h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest opacity-60 font-medium">
              Agentic Analysis
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="sm" className="h-8 gap-2 bg-white/5 border border-white/5 hover:bg-white/10">
                <Clock className="h-3.5 w-3.5" />
                <span className="max-w-[100px] truncate text-xs">
                  {sessions.find(s => s.session_id === currentSessionId)?.name || "History"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[240px] bg-[#111312] border-zinc-800/80 p-1">
              <DropdownMenuItem onClick={handleNewSession} className="gap-2 focus:bg-emerald-500/10 focus:text-emerald-400 py-2">
                <Plus className="h-4 w-4" /> New Investigation
              </DropdownMenuItem>
              <div className="h-px bg-zinc-800/60 my-1" />
              <ScrollArea className="h-[300px]">
                 {sessions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-500 italic">No sessions yet</div>
                 ) : (
                    sessions.map(s => (
                      <DropdownMenuItem 
                        key={s.session_id} 
                        onClick={() => setSession(s.session_id)}
                        className={cn(
                          "flex flex-col items-start gap-1 p-3 focus:bg-zinc-800/60 transition-all mb-1",
                          currentSessionId === s.session_id && "bg-emerald-500/5 border-l-2 border-emerald-500"
                        )}
                      >
                        <span className="font-bold text-xs truncate w-full text-zinc-200">{s.name}</span>
                        <span className="text-[10px] text-zinc-500">{new Date(s.last_modified).toLocaleString()}</span>
                      </DropdownMenuItem>
                    ))
                 )}
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

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-500/5 rounded-full flex items-center justify-center text-emerald-500/20 border border-emerald-500/10">
                <MessageSquare className="size-8" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-zinc-100">AI Investigator Ready</h4>
                <p className="text-xs text-zinc-500 mt-2 px-10 leading-relaxed">
                  Analyze your logs, find anomalies, or reconstruct error traces with ADK agents.
                </p>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn(
                "flex gap-4 group",
                m.role === "user" ? "flex-row-reverse" : "flex-row"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border transition-transform group-hover:scale-105",
                  m.role === "user" ? "bg-zinc-900 border-zinc-800" : "bg-violet-500/10 border-violet-500/20"
                )}>
                  {m.role === "user" ? <User className="size-4 text-zinc-400" /> : <Bot className="size-4 text-violet-400" />}
                </div>
                <div className={cn(
                  "flex flex-col max-w-[85%] space-y-2",
                  m.role === "user" ? "items-end" : "items-start"
                )}>
                  {m.context_logs && m.context_logs.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      <span className="bg-emerald-500/10 px-2 py-0.5 rounded text-[9px] text-emerald-400 border border-emerald-500/20 font-medium">
                        {m.context_logs.length} logs attached
                      </span>
                    </div>
                  )}
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm",
                    m.role === "user" 
                      ? "bg-zinc-800 text-zinc-100 border border-zinc-700/50 rounded-tr-none" 
                      : "bg-[#111312] text-zinc-300 border border-zinc-800/60 rounded-tl-none font-medium"
                  )}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                  <span className="text-[9px] text-zinc-600 font-medium px-1 tracking-tight">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
          {isLoading && (
             <div className="flex gap-4">
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
              <button onClick={clearSelection} className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors font-bold decoration-dotted underline underline-offset-2">
                Clear Selection
              </button>
           </div>
        )}
        
        <div className="relative group/input">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Search patterns or analyze errors..."
            className="min-h-[120px] max-h-[400px] bg-zinc-900/50 border-zinc-800 rounded-2xl resize-none py-4 pr-12 focus:ring-emerald-500/20 text-zinc-100 placeholder:text-zinc-600 transition-all focus:border-emerald-500/30"
          />
          <Button 
            size="icon" 
            className={cn(
              "absolute bottom-3 right-3 rounded-xl transition-all shadow-lg",
              inputValue.trim() ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-zinc-800 text-zinc-600 opacity-50"
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

function IconButton({ icon, label, onClick, className }: { readonly icon: any, readonly label: string, readonly onClick: () => void, readonly className?: string }) {
  return (
    <button type="button" className={cn("inline-flex items-center justify-center rounded-lg hover:bg-zinc-800/80 transition-colors h-8 w-8", className)} onClick={onClick} title={label}>
      {icon}
    </button>
  );
}
