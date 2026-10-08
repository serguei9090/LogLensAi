import { Button } from "@/components/ui/button";
import { Clock, Info } from "lucide-react";
import type { ActiveSelection } from "./types";

interface SelectionToolbarProps {
  selection: ActiveSelection;
  onMapTimestamp: () => void;
  onMapLevel: () => void;
}

export function SelectionToolbar({
  selection,
  onMapTimestamp,
  onMapLevel,
}: SelectionToolbarProps) {
  return (
    <div
      style={{
        position: "fixed",
        top: (selection.rect?.top || 0) - 48,
        left: (selection.rect?.left || 0) + (selection.rect?.width || 0) / 2,
        transform: "translateX(-50%)",
      }}
      className="z-[999] flex items-center gap-1 p-1 bg-bg-surface border border-border-subtle rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onMapTimestamp}
        className="px-2 py-1.5 rounded-md hover:bg-primary/20 text-primary text-xs font-bold transition-colors flex items-center gap-1.5"
      >
        <Clock className="size-3" /> Map Timestamp
      </Button>
      <div className="w-px h-4 bg-white/10 mx-1" />
      <Button
        type="button"
        variant="ghost"
        onClick={onMapLevel}
        className="px-2 py-1.5 rounded-md hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold transition-colors flex items-center gap-1.5"
      >
        <Info className="size-3" /> Map Level
      </Button>
    </div>
  );
}
