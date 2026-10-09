// Assume Role: Frontend Engineer (@frontend)

import { Clock, MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AiSession } from "@/store/aiStore";

interface StudioFloatingControlsProps {
  readonly sessions: AiSession[];
  readonly currentSessionId: string | null;
  readonly onSelectSession: (id: string | null) => void;
  readonly onNewSession: () => void;
  readonly onDeleteSession: (id: string) => void;
}

export function StudioFloatingControls({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: Readonly<StudioFloatingControlsProps>) {
  const activeSession = sessions.find((s) => s.session_id === currentSessionId);

  return (
    <div className="absolute top-4 right-4 z-40 flex items-center gap-2 pointer-events-auto">
      {/* Active Session Label Pill (if viewing an active existing session) */}
      {activeSession && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-surface/80 border border-white/10 backdrop-blur-xl text-xs font-mono text-text-muted shadow-lg">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          <span className="truncate max-w-[180px] text-text-secondary">{activeSession.name}</span>
        </div>
      )}

      {/* History Dropdown Trigger Button */}
      {sessions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-8.5 px-3 rounded-xl gap-1.5 text-xs font-mono border-white/10 bg-bg-surface/80 hover:bg-bg-surface backdrop-blur-xl shadow-lg hover:border-white/20 transition-all text-text-secondary hover:text-text-primary"
              >
                <Clock className="size-3.5 text-text-muted" />
                <span>History ({sessions.length})</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-68 max-h-80 overflow-y-auto p-1.5 rounded-xl bg-[#141715]/95 border-white/10 backdrop-blur-2xl shadow-2xl">
            <div className="px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted border-b border-white/5 mb-1">
              Previous Conversations
            </div>
            {sessions.map((s) => {
              const isActive = s.session_id === currentSessionId;
              return (
                <div
                  key={s.session_id}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs group transition-colors ${
                    isActive ? "bg-primary/10 border border-primary/20 text-primary" : "hover:bg-white/5 text-text-secondary"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectSession(s.session_id)}
                    className="flex-1 text-left truncate font-mono hover:text-text-primary mr-2"
                  >
                    {s.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(s.session_id);
                    }}
                    className="size-5.5 opacity-0 group-hover:opacity-100 text-text-muted hover:text-rose-400 rounded-md"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* New Studio Session / New Chat Floating Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onNewSession}
        className="h-8.5 px-3.5 rounded-xl gap-1.5 text-xs font-mono border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary backdrop-blur-xl shadow-lg shadow-primary/5 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        <MessageSquarePlus className="size-3.5" />
        <span className="font-semibold">New Chat</span>
      </Button>
    </div>
  );
}
