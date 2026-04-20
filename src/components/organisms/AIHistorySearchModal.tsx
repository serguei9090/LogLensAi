import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAiStore } from "@/store/aiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Calendar, Search, Trash2 } from "lucide-react";
import { useState } from "react";

interface AIHistorySearchModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function AIHistorySearchModal({ open, onOpenChange }: AIHistorySearchModalProps) {
  const { sessions, currentSessionId, setSession, deleteSession, setSidebarOpen } = useAiStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSessions = sessions.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSelect = (sessionId: string) => {
    setSession(sessionId);
    setSidebarOpen(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-zinc-950/90 border-zinc-800/60 backdrop-blur-xl p-0 overflow-hidden outline-none">
        <DialogHeader className="p-4 border-b border-zinc-800/40">
          <DialogTitle className="text-zinc-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Search className="size-3.5" />
            Search Investigations
          </DialogTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
            <Input
              autoFocus
              placeholder="Filter by name or keywords..."
              className="bg-zinc-900/50 border-zinc-800 pl-10 h-11 text-sm focus-visible:ring-emerald-500/30"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm italic">
              No matching investigations found.
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredSessions.map((session) => (
                <button
                  type="button"
                  key={session.session_id}
                  tabIndex={0}
                  className={cn(
                    "group flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer border border-transparent outline-none focus-visible:bg-white/5",
                    currentSessionId === session.session_id
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : "hover:bg-zinc-800/40 hover:border-zinc-700/50",
                  )}
                  onClick={() => handleSelect(session.session_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(session.session_id);
                    }
                  }}
                >
                  <div className="flex flex-col gap-1 min-w-0 pr-4">
                    <span
                      className={cn(
                        "text-sm font-semibold truncate",
                        currentSessionId === session.session_id
                          ? "text-emerald-400"
                          : "text-zinc-200",
                      )}
                    >
                      {session.name}
                    </span>
                    <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(session.last_modified).toLocaleDateString()}
                      </span>
                      <span>
                        {new Date(session.last_modified).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg shrink-0 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeWorkspaceId) {
                        deleteSession(session.session_id, activeWorkspaceId);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t border-zinc-800/40 bg-zinc-900/20 flex justify-between items-center">
          <span className="text-[10px] text-zinc-500 font-medium">
            {filteredSessions.length} sessions found
          </span>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-400 font-mono">
              ESC
            </kbd>
            <span className="text-[10px] text-zinc-500">to close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
