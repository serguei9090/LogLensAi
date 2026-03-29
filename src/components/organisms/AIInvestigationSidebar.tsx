import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  ChevronDown
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
      model: "gemini-2.0-flash", // Default or from settings
    });
    
    // Clear selection after sendingcontext
    if (selectedLogIds.length > 0) {
      clearSelection();
    }
  };

  const handleNewSession = () => {
    setSession(null);
  };

  return (
    <Sheet open={isSidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent side="right" className="w-[450px] p-0 flex flex-col border-l border-white/10 bg-[#0D0F0E]">
        <SheetHeader className="p-4 border-b border-white/5 flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="bg-violet-500/10 p-2 rounded-xl">
              <Sparkles className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <SheetTitle className="text-sm font-bold">Investigation Hub</SheetTitle>
              <p className="text-[10px] text-text-muted uppercase tracking-widest opacity-60">
                Agentic Log Analysis
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" size="sm" className="h-8 gap-2 bg-white/5 border border-white/5">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="max-w-[100px] truncate">
                    {sessions.find(s => s.session_id === currentSessionId)?.name || "History"}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[240px] bg-[#111312] border-white/10">
                <DropdownMenuItem onClick={handleNewSession} className="gap-2 focus:bg-primary/10">
                  <Plus className="h-4 w-4" /> New Investigation
                </DropdownMenuItem>
                <div className="h-px bg-white/5 my-1" />
                <ScrollArea className="h-[300px]">
                   {sessions.length === 0 ? (
                      <div className="p-4 text-center text-xs text-text-muted italic">No sessions yet</div>
                   ) : (
                      sessions.map(s => (
                        <DropdownMenuItem 
                          key={s.session_id} 
                          onClick={() => setSession(s.session_id)}
                          className={cn(
                            "flex flex-col items-start gap-1 p-3 focus:bg-white/5",
                            currentSessionId === s.session_id && "bg-primary/5 border-l-2 border-primary"
                          )}
                        >
                          <span className="font-bold text-xs truncate w-full">{s.name}</span>
                          <span className="text-[10px] opacity-40">{new Date(s.last_modified).toLocaleString()}</span>
                        </DropdownMenuItem>
                      ))
                   )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-text-muted/20">
                  <MessageSquare className="size-8" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-text-primary">No message history</h4>
                  <p className="text-xs text-text-muted mt-1 px-10">
                    Ask the AI to analyze your logs, find anomalies, or explain a specific error trace.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn(
                  "flex gap-3",
                  m.role === "user" ? "flex-row-reverse" : "flex-row"
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border",
                    m.role === "user" ? "bg-white/5 border-white/10" : "bg-violet-500/10 border-violet-400/20"
                  )}>
                    {m.role === "user" ? <User className="size-4 text-text-muted" /> : <Bot className="size-4 text-violet-400" />}
                  </div>
                  <div className={cn(
                    "flex flex-col max-w-[85%] space-y-1.5",
                    m.role === "user" ? "items-end" : "items-start"
                  )}>
                    {m.context_logs && m.context_logs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        <span className="bg-white/5 px-2 py-0.5 rounded text-[9px] text-text-muted border border-white/5">
                          {m.context_logs.length} logs attached
                        </span>
                      </div>
                    )}
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-[13px] leading-relaxed",
                      m.role === "user" 
                        ? "bg-white/5 text-text-secondary border border-white/5 rounded-tr-none" 
                        : "bg-[#111312] text-text-primary border border-white/10 rounded-tl-none"
                    )}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                    <span className="text-[9px] text-text-muted opacity-40 px-1">
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
               <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-violet-500/10 border border-violet-400/20">
                    <Bot className="size-4 text-violet-400 animate-pulse" />
                  </div>
                  <div className="bg-[#111312] border border-white/10 px-4 py-3 rounded-2xl rounded-tl-none">
                     <div className="flex gap-1.5">
                        <div className="size-1.5 bg-violet-400/40 rounded-full animate-bounce" />
                        <div className="size-1.5 bg-violet-400/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="size-1.5 bg-violet-400/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                     </div>
                  </div>
               </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-white/5 space-y-3">
          {selectedLogIds.length > 0 && (
             <div className="flex items-center justify-between px-3 py-1.5 bg-violet-500/5 border border-violet-400/10 rounded-lg">
                <span className="text-[10px] font-medium text-violet-300">
                  {selectedLogIds.length} logs selected as context
                </span>
                <button onClick={clearSelection} className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
                  Clear
                </button>
             </div>
          )}
          
          <div className="relative">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a question about the selected logs..."
              className="min-h-[100px] max-h-[300px] bg-white/5 border-white/10 rounded-2xl resize-none py-4 pr-12 focus:ring-violet-500/30"
            />
            <Button 
              size="icon" 
              className={cn(
                "absolute bottom-3 right-3 rounded-xl transition-all",
                inputValue.trim() ? "bg-violet-600 hover:bg-violet-500" : "bg-white/5 opacity-50"
              )}
              disabled={!inputValue.trim() || isLoading}
              onClick={handleSend}
            >
              <Send className="size-4" />
            </Button>
          </div>
          
          <div className="flex justify-between items-center opacity-60">
             <span className="text-[9px] text-text-muted">
               Agentic Analysis: powered by ADK 2.0
             </span>
             <div className="flex gap-2">
                <IconButton 
                  icon={<Trash2 className="size-3" />} 
                  label="Delete Session" 
                  onClick={() => {}} // TODO
                  className="size-6 bg-white/5 hover:bg-red-500/10 hover:text-red-400"
                />
             </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function IconButton({ icon, label, onClick, className }: { icon: any, label: string, onClick: () => void, className?: string }) {
  return (
    <Button variant="ghost" size="icon" className={cn("rounded-lg", className)} onClick={onClick} title={label}>
      {icon}
    </Button>
  );
}
