import { X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LogSource } from "@/store/workspaceStore";

interface WorkspaceTabsProps {
  /** All sources attached to the active workspace */
  sources: LogSource[];
  /** Currently-active source id, or null for the aggregate "All" tab */
  activeSourceId: string | null;
  /** Set of source IDs that are currently live-tailing */
  tailingSourceIds?: Set<string>;
  /** Called when user selects a tab */
  onSelectSource: (sourceId: string | null) => void;
  /** Called when user removes a source tab */
  onRemoveSource?: (sourceId: string) => void;
  /** Called when user wants to edit a fusion-type tab */
  onEditFusion?: (sourceId: string) => void;
}

/**
 * WorkspaceTabs renders a horizontal tab-strip for switching between log
 * sources within the active workspace.
 *
 * - Each source tab shows the filename derived from its path.
 * - Fusion-type sources show an edit icon to re-open the Orchestrator.
 * - A pulsing green dot appears when the source is being tailed.
 * - An ✕ button lets users close a source from the toolbar.
 */
export function WorkspaceTabs({
  sources,
  activeSourceId,
  tailingSourceIds = new Set(),
  onSelectSource,
  onRemoveSource,
  onEditFusion,
}: WorkspaceTabsProps) {
  if (sources.length === 0) return null;

  return (
    <div
      className="flex items-center gap-0.5 overflow-x-auto scrollbar-none shrink-0"
      role="tablist"
      aria-label="Log source tabs"
    >
      {/* ── Per-source tabs ── */}
      {sources.map((src) => {
        const isActive = activeSourceId === src.id;
        const isTailing = tailingSourceIds.has(src.id);
        const isFusion = src.type === "fusion";
        const label = src.name || src.path.split(/[\\\/]/).pop() || src.path;

        return (
          <div
            key={src.id}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap shrink-0 border",
              isActive
                ? isFusion
                  ? "bg-violet-500/15 text-violet-400 border-violet-500/30"
                  : "bg-primary/15 text-primary border-primary/30"
                : "text-text-muted hover:text-text-secondary hover:bg-white/5 border-transparent",
            )}
          >
            {/* Fusion icon or live-tail indicator */}
            {isFusion ? (
              <span className="text-violet-400/70 text-[9px] font-bold uppercase tracking-wider">⚡</span>
            ) : isTailing ? (
              <span aria-label="Live tailing" className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            ) : null}

            {/* Label — clickable area */}
            <button
              type="button"
              className="max-w-[140px] truncate focus:outline-none"
              onClick={() => onSelectSource(src.id)}
              title={src.path}
            >
              {label}
            </button>

            {/* Edit button for fusion tabs */}
            {isFusion && onEditFusion && (
              <button
                type="button"
                aria-label={`Edit ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditFusion(src.id);
                }}
                className={cn(
                  "opacity-0 group-hover:opacity-100 rounded-full p-0.5 transition-opacity hover:bg-violet-500/20 focus:outline-none",
                  isActive && "opacity-60 hover:opacity-100",
                )}
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}

            {/* Remove button */}
            {onRemoveSource && (
              <button
                type="button"
                aria-label={`Remove ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSource(src.id);
                }}
                className={cn(
                  "opacity-0 group-hover:opacity-100 rounded-full p-0.5 transition-opacity hover:bg-white/10 focus:outline-none",
                  isActive && "opacity-60 hover:opacity-100",
                )}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}

      {/* Right-side divider */}
      <div className="h-4 w-px bg-border/60 mx-1 shrink-0" aria-hidden />
    </div>
  );
}
