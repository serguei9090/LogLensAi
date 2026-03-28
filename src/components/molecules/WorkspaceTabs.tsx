import { X } from "lucide-react";
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
}

/**
 * WorkspaceTabs renders a horizontal tab-strip for switching between log
 * sources within the active workspace.
 *
 * - An implicit "All" tab is always shown as the first item.
 * - Each source tab shows the filename derived from its path.
 * - A pulsing green dot appears when the source is being tailed.
 * - An ✕ button lets power-users close a source from the toolbar.
 */
export function WorkspaceTabs({
  sources,
  activeSourceId,
  tailingSourceIds = new Set(),
  onSelectSource,
  onRemoveSource,
}: WorkspaceTabsProps) {
  // No tabs to show when workspace has 0 additional sources
  if (sources.length === 0) return null;

  return (
    <div
      className="flex items-center gap-0.5 overflow-x-auto scrollbar-none shrink-0"
      role="tablist"
      aria-label="Log source tabs"
    >
      {/* ── "All" aggregate tab ── */}
      <button
        type="button"
        role="tab"
        aria-selected={activeSourceId === null}
        onClick={() => onSelectSource(null)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap shrink-0",
          activeSourceId === null
            ? "bg-primary/15 text-primary border border-primary/30"
            : "text-text-muted hover:text-text-secondary hover:bg-white/5 border border-transparent",
        )}
      >
        All
      </button>

      {/* ── Per-source tabs ── */}
      {sources.map((src) => {
        const isActive = activeSourceId === src.id;
        const isTailing = tailingSourceIds.has(src.id);
        // Extract the basename for display (cross-platform: slash and backslash)
        const label = src.name || src.path.split(/[\\/]/).pop() || src.path;

        return (
          <div
            key={src.id}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap shrink-0 border",
              isActive
                ? "bg-primary/15 text-primary border-primary/30"
                : "text-text-muted hover:text-text-secondary hover:bg-white/5 border-transparent",
            )}
          >
            {/* Live-tail indicator */}
            {isTailing && (
              <span
                aria-label="Live tailing"
                className="relative flex h-2 w-2 shrink-0"
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            )}

            {/* Label — clickable area */}
            <button
              type="button"
              className="max-w-[140px] truncate focus:outline-none"
              onClick={() => onSelectSource(src.id)}
              title={src.path}
            >
              {label}
            </button>

            {/* Remove button — visible on tab hover */}
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

      {/* Right-side divider so tabs don't blend into surrounding toolbar */}
      <div className="h-4 w-px bg-border/60 mx-1 shrink-0" aria-hidden />
    </div>
  );
}
