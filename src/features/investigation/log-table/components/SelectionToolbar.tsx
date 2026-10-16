import { Button } from "@/components/ui/button";
import { Minus, Plus, Settings2, Sparkles } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { SelectionDetails } from "../utils/selectionUtils";

interface SelectionToolbarProps {
  readonly selectionInfo: SelectionDetails;
  readonly onAddFilter: (operator: "contains" | "not_contains") => void;
  readonly onAddFacet: (useAi: boolean) => void;
  readonly onOpenParser?: (sourceId: string, initialConfig: string | null) => void;
  readonly onClose: () => void;
}

export function SelectionToolbar({
  selectionInfo,
  onAddFilter,
  onAddFacet,
  onOpenParser,
  onClose,
}: SelectionToolbarProps) {
  return createPortal(
    <div
      role="toolbar"
      aria-label="Selection actions"
      className="fixed z-[200] flex items-center gap-1 bg-bg-tooltip border border-white/10 shadow-2xl rounded-full p-1 animate-in fade-in slide-in-from-bottom-2"
      style={{
        left: selectionInfo.x,
        top: selectionInfo.y,
        transform: "translateX(-50%)",
      }}
      onMouseDown={(e) => e.preventDefault()} // Keep selection
    >
      <Button
        variant="ghost"
        size="xs"
        onClick={() => onAddFilter("contains")}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors cursor-pointer border-none"
      >
        <Plus className="size-3" /> Include
      </Button>
      <div className="w-px h-4 bg-white/10" />
      <Button
        variant="ghost"
        size="xs"
        onClick={() => onAddFilter("not_contains")}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer border-none"
      >
        <Minus className="size-3" /> Exclude
      </Button>
      <div className="w-px h-4 bg-white/10" />
      <Button
        variant="ghost"
        size="xs"
        onClick={() => onAddFacet(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer border-none"
        title="Use AI to generate a smart extraction regex"
      >
        <Sparkles className="size-3" /> AI Facet
      </Button>
      <div className="w-px h-4 bg-white/10" />
      <Button
        variant="ghost"
        size="xs"
        onClick={() => {
          if (selectionInfo.sourceId && onOpenParser) {
            onOpenParser(selectionInfo.sourceId, null);
            onClose();
            globalThis.getSelection()?.removeAllRanges();
          } else {
            toast.info("Select a specific log source to use the parser map.");
          }
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-white/5 text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer border-none"
      >
        <Settings2 className="size-3" /> Map Field
      </Button>
    </div>,
    document.body,
  );
}
