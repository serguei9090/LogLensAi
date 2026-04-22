import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { LayoutTemplate, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { FilterEntry } from "../molecules/FilterBuilder";
import type { HighlightEntry } from "../molecules/HighlightBuilder";

interface Template {
  id: number;
  name: string;
  config: string;
  created_at: string;
}

interface LoadTemplateModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly workspaceId: string;
  readonly onLoad: (filters: FilterEntry[], highlights: HighlightEntry[]) => void;
}

export function LoadTemplateModal({
  isOpen,
  onClose,
  workspaceId,
  onLoad,
}: LoadTemplateModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await callSidecar<Template[]>({
        method: "get_templates",
        params: { workspace_id: workspaceId },
      });
      setTemplates(data || []);
    } catch (error) {
      console.error("Failed to fetch templates", error);
      toast.error("Could not load templates");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, fetchTemplates]);

  const handleApply = (template: Template) => {
    try {
      const config = JSON.parse(template.config);
      onLoad(config.filters || [], config.highlights || []);
      toast.success(`Applied template: ${template.name}`);
      onClose();
    } catch (error) {
      console.error("Failed to parse template config", error);
      toast.error("Template data is corrupted");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await callSidecar({
        method: "delete_template",
        params: { id },
      });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template removed");
    } catch (error) {
      console.error("Failed to delete template", error);
      toast.error("Could not delete template");
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-muted opacity-50">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-xs font-medium">Fetching saved templates...</p>
        </div>
      );
    }

    if (templates.length === 0) {
      return (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-muted opacity-30 border border-dashed border-white/10 rounded-2xl">
          <LayoutTemplate className="size-8" />
          <p className="text-xs font-medium">No templates saved yet</p>
        </div>
      );
    }

    return templates.map((template) => (
      <button
        type="button"
        key={template.id}
        aria-label={`Load template ${template.name}`}
        onClick={() => handleApply(template)}
        className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-primary/20 transition-all group text-left cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
      >
        <div className="space-y-1">
          <p className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">
            {template.name}
          </p>
          <p className="text-[10px] text-text-muted font-mono opacity-60">
            {new Date(template.created_at).toLocaleString()}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => handleDelete(e, template.id)}
          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </button>
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-bg-surface border-border-subtle text-text-primary p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <LayoutTemplate className="size-4" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">Load Template</DialogTitle>
          </div>
          <DialogDescription className="text-text-muted text-xs leading-relaxed">
            Choose a saved configuration to apply to your current investigation.
          </DialogDescription>
        </DialogHeader>

        <div className="px-2 pb-6">
          <div className="max-h-[400px] overflow-y-auto px-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
            {renderContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
