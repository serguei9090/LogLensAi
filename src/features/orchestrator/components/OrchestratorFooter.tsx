import { Button } from "@/components/ui/button";
import type { OrchestratorView } from "../types";

interface OrchestratorFooterProps {
  readonly view: OrchestratorView;
  readonly onCancel: () => void;
  readonly onSaveAiContext: () => void;
  readonly onSaveTemporalOffsets: () => void;
  readonly onDeployFusion: () => void;
  readonly isSaving: boolean;
  readonly canDeployFusion: boolean;
}

export function OrchestratorFooter({
  view,
  onCancel,
  onSaveAiContext,
  onSaveTemporalOffsets,
  onDeployFusion,
  isSaving,
  canDeployFusion,
}: OrchestratorFooterProps) {
  if (view === "picker") {
    return null;
  }

  return (
    <div className="p-4 border-t border-white/5 bg-white/[0.01] shrink-0">
      <div className="flex gap-2">
        <Button
          variant="ghost"
          className="flex-1 h-9 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5"
          onClick={onCancel}
        >
          Cancel
        </Button>
        {view === "ai-context-form" && (
          <Button
            className="flex-1 h-9 text-xs font-medium bg-white text-black hover:bg-white/90"
            onClick={onSaveAiContext}
          >
            Save
          </Button>
        )}
        {view === "time-alignment-form" && (
          <Button
            className="flex-1 h-9 text-xs font-medium bg-white text-black hover:bg-white/90"
            onClick={onSaveTemporalOffsets}
            disabled={isSaving}
          >
            {isSaving ? "Syncing..." : "Apply"}
          </Button>
        )}
        {view === "fusion-form" && (
          <Button
            className="flex-1 h-9 text-xs font-medium bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={onDeployFusion}
            disabled={isSaving || !canDeployFusion}
          >
            {isSaving ? "Saving..." : "Deploy"}
          </Button>
        )}
      </div>
    </div>
  );
}
