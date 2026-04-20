import { cn } from "@/lib/utils";
import type { LogSource } from "@/store/workspaceStore";
import { Pencil, X } from "lucide-react";
import { useState } from "react";

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
  /** Called when user renames a source tab */
  onRenameSource?: (workspaceId: string, sourceId: string, name: string) => void;
  activeWorkspaceId: string;
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
  onRenameSource,
  activeWorkspaceId,
}: Readonly<WorkspaceTabsProps>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setNewName(currentName);
  };

  const handleConfirmRename = (id: string) => {
    if (onRenameSource && newName.trim()) {
      onRenameSource(activeWorkspaceId, id, newName.trim());
    }
    setEditingId(null);
  };
  if (sources.length === 0) {
    return null;
  }

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
        const label = src.name || src.path.split(/[\\/]/).pop() || src.path;

        let activeStyles = "border-transparent hover:bg-white/5";
        if (isActive) {
          activeStyles = isFusion
            ? "bg-violet-500/15 border-violet-500/30"
            : "bg-primary/15 border-primary/30";
        }

        let labelStyles = "text-text-muted hover:text-text-secondary";
        if (isActive) {
          labelStyles = isFusion ? "text-violet-400" : "text-primary";
        }

        return (
          <div
            key={src.id}
            className={cn(
              "group inline-flex items-center gap-1 px-1 rounded-md transition-all whitespace-nowrap shrink-0 border",
              activeStyles,
            )}
          >
            {/* Primary Tab Button */}
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectSource(src.id)}
              title={src.path}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-semibold transition-all outline-none",
                labelStyles,
              )}
            >
              {/* Fusion icon or live-tail indicator */}
              {isFusion && (
                <span className="text-violet-400/70 text-[9px] font-bold uppercase tracking-wider">
                  ⚡
                </span>
              )}

              {!isFusion && isTailing && (
                <span aria-label="Live tailing" className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
              )}

              {editingId === src.id ? (
                <input
                  // biome-ignore lint/a11y/noAutofocus: intentional for renaming
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleConfirmRename(src.id);
                    }
                    if (e.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  onBlur={() => handleConfirmRename(src.id)}
                  className="bg-primary/20 border border-primary/30 rounded px-1.5 py-0.5 text-[11px] font-semibold text-primary outline-none w-[140px]"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="max-w-[140px] truncate">{label}</span>
              )}
            </button>

            {/* Action Group */}
            <div className="flex items-center gap-0.5 pr-1">
              {/* Rename button (for all tabs) */}
              {onRenameSource && editingId !== src.id && (
                <button
                  type="button"
                  aria-label={`Rename ${label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(src.id, label);
                  }}
                  className={cn(
                    "opacity-0 group-hover:opacity-100 rounded-full p-0.5 transition-opacity hover:bg-white/10 focus:outline-none",
                    isActive && "opacity-60 hover:opacity-100",
                  )}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}

              {/* Edit button for fusion tabs (Config) */}
              {isFusion && onEditFusion && (
                <button
                  type="button"
                  aria-label={`Configure Fusion ${label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditFusion(src.id);
                  }}
                  className={cn(
                    "opacity-0 group-hover:opacity-100 rounded-full p-0.5 transition-opacity hover:bg-violet-500/20 focus:outline-none",
                    isActive && "opacity-60 hover:opacity-100",
                  )}
                >
                  <span className="text-[10px] font-bold">⚙️</span>
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
          </div>
        );
      })}

      {/* Right-side divider */}
      <div className="h-4 w-px bg-border/60 mx-1 shrink-0" aria-hidden />
    </div>
  );
}
