import { Clock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AiSession } from "@/store/aiStore";

interface StudioHeaderBarProps {
  readonly sessions: AiSession[];
  readonly currentSessionId: string | null;
  readonly onSelectSession: (id: string | null) => void;
  readonly onNewSession: () => void;
  readonly onDeleteSession: (id: string) => void;
}

export function StudioHeaderBar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: Readonly<StudioHeaderBarProps>) {
  const activeSession = sessions.find((s) => s.session_id === currentSessionId);

  return (
    <div className="flex items-center justify-between px-6 py-3.5 border-b border-border/50 bg-bg-surface/30 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider text-text-primary uppercase">
            A2UI Generative Studio
          </span>
        </div>

        {activeSession && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-text-muted">
            <span className="truncate max-w-[200px]">{activeSession.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {sessions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-mono border-border/60"
                >
                  <Clock className="size-3.5 text-text-muted" />
                  <span>History ({sessions.length})</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
              {sessions.map((s) => (
                <div
                  key={s.session_id}
                  className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded-md text-xs group"
                >
                  <button
                    type="button"
                    onClick={() => onSelectSession(s.session_id)}
                    className="flex-1 text-left truncate font-mono text-text-secondary hover:text-text-primary mr-2"
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
                    className="size-6 opacity-0 group-hover:opacity-100 text-text-muted hover:text-rose-400"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onNewSession}
          className="h-8 gap-1.5 text-xs font-mono border-primary/30 text-primary hover:bg-primary/10"
        >
          <Plus className="size-3.5" />
          <span>New Studio Session</span>
        </Button>
      </div>
    </div>
  );
}
