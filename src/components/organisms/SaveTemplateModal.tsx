import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { Bookmark, Filter, Highlighter } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { FilterEntry } from "../molecules/FilterBuilder";
import type { HighlightEntry } from "../molecules/HighlightBuilder";

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  filters: FilterEntry[];
  highlights: HighlightEntry[];
}

export function SaveTemplateModal({
  isOpen,
  onClose,
  workspaceId,
  filters,
  highlights,
}: SaveTemplateModalProps) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    setIsSaving(true);
    try {
      const config = {
        filters,
        highlights,
      };

      await callSidecar({
        method: "save_template",
        params: {
          workspace_id: workspaceId,
          name: name.trim(),
          config_json: JSON.stringify(config),
        },
      });

      toast.success("Discovery template saved");
      onClose();
      setName("");
    } catch (error) {
      console.error("Failed to save template", error);
      toast.error("Could not save template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-[#0D1110] border-border/40 text-text-primary">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Bookmark className="size-4" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">Save Template</DialogTitle>
          </div>
          <DialogDescription className="text-text-muted text-xs leading-relaxed">
            Persist your current filter and highlight configuration as a reusable template.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-6">
          <div className="space-y-3">
            <label htmlFor="template-name" className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
              Template Name
            </label>
            <Input
              id="template-name"
              placeholder="e.g. Production Error Analysis"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-black/40 border-border/40 text-sm focus:ring-primary/20"
              autoFocus
            />
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-4">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-text-muted">
              <span>Configuration Summary</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="size-3 text-primary/60" />
                <span className="text-xs text-text-secondary">{filters.length} Filters</span>
              </div>
              <div className="flex items-center gap-2">
                <Highlighter className="size-3 text-emerald-400/60" />
                <span className="text-xs text-text-secondary">{highlights.length} Highlights</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-border/40 hover:bg-white/5 text-xs h-10 px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="bg-primary text-black hover:bg-primary-hover font-bold text-xs h-10 px-8 shadow-lg shadow-primary/10"
          >
            {isSaving ? "Saving..." : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
