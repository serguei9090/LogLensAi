import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LogSource } from "@/store/workspaceStore";
import { Check, FileText, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface SourceItemProps {
  source: LogSource;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  isRenaming: boolean;
  onRenamingChange: (renaming: boolean) => void;
}

export function SourceItem({
  source,
  active,
  onClick,
  onDelete,
  onRename,
  isRenaming,
  onRenamingChange,
}: Readonly<SourceItemProps>) {
  const [nameValue, setNameValue] = useState(source.name);

  useEffect(() => {
    if (isRenaming) {
      setNameValue(source.name);
    }
  }, [isRenaming, source.name]);

  const handleConfirmRename = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== source.name) {
      onRename(trimmed);
    }
    onRenamingChange(false);
  };

  if (isRenaming) {
    return (
      <div className="px-2 py-1">
        <input
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={handleConfirmRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleConfirmRename();
            }
            if (e.key === "Escape") {
              onRenamingChange(false);
            }
          }}
          className="w-full bg-bg-app/40 border border-primary/30 rounded px-1.5 py-0.5 text-[11px] text-text-primary outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>
    );
  }

  return (
    <div className="group flex items-center px-1 py-0.5">
      <button
        type="button"
        className={cn(
          "flex-1 flex items-center gap-2 px-2 py-1.5 text-[12px] rounded transition-all text-left outline-none border-none bg-transparent cursor-pointer overflow-hidden",
          active
            ? "text-primary font-medium bg-primary/5 shadow-[inset_1px_0_0_0_currentColor]"
            : "text-text-muted hover:text-text-secondary hover:bg-bg-hover",
        )}
        onClick={onClick}
      >
        <FileText
          className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-text-muted/60")}
        />
        <span className="truncate flex-1 min-w-0">{source.name}</span>
      </button>
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 pr-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onRenamingChange(true);
          }}
          className="h-6 w-6 text-text-muted hover:text-primary transition-colors"
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="h-6 w-6 text-error/80 hover:text-error transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
