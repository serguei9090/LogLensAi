import { Calendar, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAiStore } from "@/store/aiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

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
      <DialogContent className="max-w-2xl bg-bg-surface-bright/95 border-border/60 backdrop-blur-xl p-0 overflow-hidden outline-none shadow-2xl">
        <DialogHeader className="p-4 border-b border-zinc-800/40">
          <DialogTitle className="text-text-muted text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <Search className="size-3" />
            Search Investigations
          </DialogTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
            <Input
              autoFocus
              placeholder="Filter by name or keywords..."
              className="bg-bg-surface border-border/40 pl-10 h-11 text-sm focus-visible:ring-primary/20 text-text-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm italic">
              No matching investigations found.
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredSessions.map((session) => (
                <div key={session.session_id} className="group relative">
                  <button
                    type="button"
                    className={cn(
                      "w-full text-left flex items-center justify-between p-3 rounded-xl transition-all border border-transparent outline-none focus-visible:bg-white/5",
                      currentSessionId === session.session_id
                        ? "bg-primary/10 border-primary/20"
                        : "hover:bg-bg-hover hover:border-border",
                    )}
                    onClick={() => handleSelect(session.session_id)}
                  >
                    <div className="flex flex-col gap-1 min-w-0 pr-10">
                      <span
                        className={cn(
                          "text-sm font-semibold truncate",
                          currentSessionId === session.session_id
                            ? "text-primary"
                            : "text-text-primary",
                        )}
                      >
                        {session.name}
                      </span>
                      <div className="flex items-center gap-3 text-[10px] text-text-muted">
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
                  </button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-8 opacity-0 group-hover:opacity-100 text-text-muted hover:text-error hover:bg-error/10 rounded-lg shrink-0 transition-opacity z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeWorkspaceId) {
                        deleteSession(session.session_id, activeWorkspaceId);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t border-border/40 bg-bg-surface/50 flex justify-between items-center">
          <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">
            {filteredSessions.length} sessions found
          </span>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-bg-surface-bright border border-border text-[10px] text-text-primary font-mono">
              ESC
            </kbd>
            <span className="text-[10px] text-text-muted">to close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
