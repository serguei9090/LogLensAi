// Assume Role: Frontend Engineer (@frontend)
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { Columns2, GripVertical, PanelLeftClose, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AddColumnModal } from "@/components/molecules/AddColumnModal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SortableColumnRowProps {
  readonly id: string;
  readonly label: string;
  readonly visible: boolean;
  readonly badge?: "built-in" | "auto" | "user";
  readonly onToggle: () => void;
  readonly onDelete?: () => void;
}

function SortableColumnRow({
  id,
  label,
  visible,
  badge,
  onToggle,
  onDelete,
}: SortableColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
  };

  let badgeClass = "";
  let badgeText = "regex";

  if (badge === "built-in") {
    badgeClass = "bg-white/5 text-text-muted border border-white/10";
    badgeText = "built-in";
  } else if (badge === "auto") {
    badgeClass = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    badgeText = "auto";
  } else {
    badgeClass = "bg-purple-500/10 text-purple-400 border border-purple-500/20";
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors group select-none border border-transparent bg-bg-app/50",
        isDragging && "border-primary/20 bg-white/[0.06] shadow-lg cursor-grabbing",
      )}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-text-muted/40 hover:text-text-muted transition-colors p-1"
        title="Drag to reorder column"
      >
        <GripVertical className="size-3.5 shrink-0" />
      </span>

      {/* Checkbox & label */}
      <label
        htmlFor={`col-toggle-${id}`}
        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
      >
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
      </label>

      {badge && (
        <span
          className={cn(
            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 scale-[0.85] origin-right",
            badgeClass,
          )}
        >
          {badgeText}
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
          className="h-5 w-5 opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0 ml-1"
          title={`Remove ${label} column`}
        >
          <Trash2 className="size-2.5" />
        </Button>
      )}
    </div>
  );
}

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
    columnOrder,
    setColumnOrder,
  } = useUIStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4, // Allow clicking check-boxes without initiating drag
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = columnOrder.indexOf(active.id as string);
    const newIndex = columnOrder.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) {
      setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
    }
  };

  const getColumnDetails = (colId: string) => {
    switch (colId) {
      case "id":
        return { label: "ID", badge: "built-in" as const };
      case "timestamp":
        return { label: "Timestamp", badge: "built-in" as const };
      case "ingest_timestamp":
        return { label: "Ingest Time", badge: "built-in" as const };
      case "level":
        return { label: "Level", badge: "built-in" as const };
      case "message":
        return { label: "Message", badge: "built-in" as const };
      case "cluster_id":
        return { label: "Cluster", badge: "built-in" as const };
      case "actions":
        return { label: "Actions", badge: "built-in" as const };
    }
    const custom = customColumns.find((c) => c.id === colId);
    if (custom) {
      return {
        label: custom.label,
        badge: custom.source,
        onDelete: custom.source === "user" ? () => removeCustomColumn(custom.id) : undefined,
      };
    }
    return null;
  };

  // Only render columns present in current workspace hierarchy
  const orderedList = columnOrder
    .map((colId) => {
      const details = getColumnDetails(colId);
      if (!details) {
        return null;
      }
      return {
        id: colId,
        label: details.label,
        visible: visibleColumns[colId] ?? false,
        badge: details.badge,
        onDelete: details.onDelete,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <>
      <motion.div
        initial={false}
        animate={{
          width: columnManagerCollapsed ? 0 : 256,
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
          <div className="p-3">
            <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted/60 block mb-3 px-1">
              Active Layout Order (Drag to sort)
            </span>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedList.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {orderedList.map((item) => (
                    <SortableColumnRow
                      key={item.id}
                      id={item.id}
                      label={item.label}
                      visible={item.visible}
                      badge={item.badge}
                      onToggle={() => toggleColumnVisibility(item.id)}
                      onDelete={item.onDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
