import { IconButton } from "@/components/atoms/IconButton";
import { Button } from "@/components/ui/button";
import type { LogEntry } from "@/types/log";
import { StickyNote, X } from "lucide-react";
import { toast } from "sonner";

interface AnnotationDrawerProps {
  readonly expandedRow: number;
  readonly logs: LogEntry[];
  readonly commentText: string;
  readonly setCommentText: (text: string) => void;
  readonly onAddComment: (id: number, comment: string) => void;
  readonly onClose: () => void;
}

export function AnnotationDrawer({
  expandedRow,
  logs,
  commentText,
  setCommentText,
  onAddComment,
  onClose,
}: AnnotationDrawerProps) {
  const currentLog = logs.find((l) => l.id === expandedRow);
  const lineDisplay = (currentLog?.line_id ?? -1) + 1 || expandedRow;

  return (
    <div
      id={`row-details-${expandedRow}`}
      className="sticky bottom-0 left-0 w-full bg-bg-tooltip/95 border-t border-white/10 p-6 shadow-2xl z-20 animate-in slide-in-from-bottom duration-300 backdrop-blur-xl max-h-[400px]"
    >
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-3">
          <div className="bg-primary/10 p-1.5 rounded-lg border border-primary/20">
            <StickyNote className="h-4 w-4 text-primary" />
          </div>
          Log Entry Annotation
          <span className="text-text-muted font-mono text-xs ml-2 opacity-50 bg-white/5 px-2 py-0.5 rounded-full">
            Line: {lineDisplay}
          </span>
        </h3>
        <div className="flex items-center gap-3">
          {currentLog?.has_comment && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-4 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors uppercase tracking-widest"
              onClick={() => {
                onAddComment(expandedRow, "");
                setCommentText("");
                toast.success("Note cleared");
              }}
            >
              Delete Note
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-6 text-xs font-bold uppercase tracking-widest border-primary/20 bg-primary/5 hover:bg-primary/10 hover:text-primary transition-all rounded-lg"
            onClick={() => {
              onAddComment(expandedRow, commentText);
              toast.success("Note saved");
            }}
          >
            Save Note
          </Button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <IconButton
            icon={<X className="h-4 w-4" />}
            label="Close Annotation"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors bg-white/5 rounded-lg h-9 w-9"
          />
        </div>
      </div>

      <div className="relative group max-w-4xl mx-auto">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
        <textarea
          id={`note-editor-${expandedRow}`}
          className="relative w-full h-[180px] text-sm font-sans leading-relaxed text-text-primary bg-bg-base/60 p-6 rounded-2xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none placeholder:text-text-muted/20 scrollbar-thin"
          placeholder="Add investigation details, identified causes, or diagnostic insights for this log entry..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
        />
      </div>
    </div>
  );
}
