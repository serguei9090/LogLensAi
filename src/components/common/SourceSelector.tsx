import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SourceOption {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface SourceSelectorProps {
  options: SourceOption[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * SourceSelector is a segmented control molecule used for high-level
 * navigation between data sources or ingestion types.
 *
 * It follows the "Engine Precision" design language with a glassmorphic
 * background and compact, precise button sizing.
 */
export function SourceSelector({ options, activeId, onSelect, className }: SourceSelectorProps) {
  return (
    <div
      className={cn(
        "flex gap-1.5 bg-bg-base/80 rounded-2xl p-1 border border-border/60 shadow-inner",
        className,
      )}
    >
      {options.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
            activeId === id
              ? "bg-primary text-bg-base shadow-lg shadow-primary/10"
              : "text-text-muted hover:text-text-secondary hover:bg-white/5",
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
