// Assume Role: Frontend Engineer (@frontend)
import { motion } from "framer-motion";
import { Columns2, PanelLeftClose, Plus, Sparkle, Trash2, User } from "lucide-react";
import { useState } from "react";
import { AddColumnModal } from "@/components/molecules/AddColumnModal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ColumnRowProps {
  readonly id: string;
  readonly label: string;
  readonly visible: boolean;
  readonly badge?: "auto" | "user";
  readonly onToggle: () => void;
  readonly onDelete?: () => void;
}

function ColumnRow({ id, label, visible, badge, onToggle, onDelete }: ColumnRowProps) {
  return (
    <label
      htmlFor={`col-toggle-${id}`}
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-md cursor-pointer hover:bg-white/[0.04] transition-colors group select-none"
    >
      {/* Native checkbox — hidden visually, custom styled */}
      <span className="relative flex items-center justify-center shrink-0">
        <input
          type="checkbox"
          id={`col-toggle-${id}`}
          checked={visible}
          onChange={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            "w-3.5 h-3.5 rounded border flex items-center justify-center transition-all duration-150",
            visible
              ? "bg-primary border-primary"
              : "border-white/20 bg-transparent hover:border-white/40",
          )}
        >
          {visible && (
            <svg
              viewBox="0 0 10 8"
              className="w-2 h-2 fill-none stroke-white stroke-[2]"
              aria-hidden="true"
            >
              <path d="M1 4l2.5 2.5L9 1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </span>

      <span
        className={cn(
          "flex-1 text-xs font-medium truncate transition-colors",
          visible ? "text-text-primary" : "text-text-muted",
        )}
      >
        {label}
      </span>

      {badge && (
        <span
          className={cn(
            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0",
            badge === "auto"
              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
              : "bg-purple-500/10 text-purple-400 border border-purple-500/20",
          )}
        >
          {badge === "auto" ? "auto" : "regex"}
        </span>
      )}

      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="h-5 w-5 opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
          title={`Remove ${label} column`}
        >
          <Trash2 className="size-2.5" />
        </Button>
      )}
    </label>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 pt-4 pb-1">
      <Icon className="size-3 text-text-muted/60 shrink-0" />
      <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted/60">
        {title}
      </span>
    </div>
  );
}

// ─── Built-in column definitions ─────────────────────────────────────────────

const BUILTIN_COLUMNS = [
  { id: "id", label: "ID" },
  { id: "timestamp", label: "Timestamp" },
  { id: "ingest_timestamp", label: "Ingest Time" },
  { id: "level", label: "Level" },
  { id: "cluster_id", label: "Cluster" },
  { id: "actions", label: "Actions" },
] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export function ColumnManagerSidebar() {
  const {
    columnManagerCollapsed,
    toggleColumnManager,
    visibleColumns,
    toggleColumnVisibility,
    customColumns,
    addCustomColumn,
    removeCustomColumn,
  } = useUIStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const autoColumns = customColumns.filter((c) => c.source === "auto");
  const userColumns = customColumns.filter((c) => c.source === "user");

  return (
    <>
      <motion.div
        initial={false}
        animate={{
          width: columnManagerCollapsed ? 0 : 220,
          opacity: columnManagerCollapsed ? 0 : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className={cn(
          "border-r border-border-subtle bg-bg-app flex flex-col h-full overflow-hidden select-none relative",
          columnManagerCollapsed ? "pointer-events-none" : "",
        )}
      >
        {/* Header */}
        <div className="h-12 border-b border-border-subtle flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Columns2 className="size-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">
              Columns
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleColumnManager}
            className="h-7 w-7 text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
            title="Close Column Manager"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="pb-4">
            {/* ── Built-in Columns ── */}
            <SectionHeader icon={Columns2} title="Built-in" />
            {BUILTIN_COLUMNS.map((col) => (
              <ColumnRow
                key={col.id}
                id={col.id}
                label={col.label}
                visible={visibleColumns[col.id] ?? false}
                onToggle={() => toggleColumnVisibility(col.id)}
              />
            ))}

            {/* ── Auto-extracted Columns ── */}
            {autoColumns.length > 0 && (
              <>
                <SectionHeader icon={Sparkle} title="Extracted" />
                {autoColumns.map((col) => (
                  <ColumnRow
                    key={col.id}
                    id={col.id}
                    label={col.label}
                    visible={visibleColumns[col.id] ?? false}
                    badge="auto"
                    onToggle={() => toggleColumnVisibility(col.id)}
                  />
                ))}
              </>
            )}

            {/* ── User-defined Columns ── */}
            {userColumns.length > 0 && (
              <>
                <SectionHeader icon={User} title="Custom" />
                {userColumns.map((col) => (
                  <ColumnRow
                    key={col.id}
                    id={col.id}
                    label={col.label}
                    visible={visibleColumns[col.id] ?? false}
                    badge="user"
                    onToggle={() => toggleColumnVisibility(col.id)}
                    onDelete={() => removeCustomColumn(col.id)}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer: Add Column button */}
        <div className="p-3 border-t border-border-subtle shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="w-full justify-start gap-2 text-xs text-text-muted hover:text-primary hover:bg-primary/10 transition-colors font-semibold"
          >
            <Plus className="size-3.5" />
            Add Column
          </Button>
        </div>
      </motion.div>

      <AddColumnModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSave={(col) => {
          addCustomColumn(col);
          setIsAddModalOpen(false);
        }}
      />
    </>
  );
}
