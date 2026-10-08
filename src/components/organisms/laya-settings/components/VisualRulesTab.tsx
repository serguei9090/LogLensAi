import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuestionType } from "@/types/laya";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";

export interface VisualRulesTabProps {
  readonly questionsList: Array<{
    name: string;
    type: QuestionType;
    instructions?: string;
    options?: string[];
    rubric?: number[];
  }>;
  readonly onOpenAddRule: () => void;
  readonly onOpenEditRule: (q: {
    name: string;
    type: QuestionType;
    instructions?: string;
    options?: string[];
    rubric?: number[];
  }) => void;
  readonly onDeleteRule: (name: string) => void;
}

export function VisualRulesTab({
  questionsList,
  onOpenAddRule,
  onOpenEditRule,
  onDeleteRule,
}: Readonly<VisualRulesTabProps>) {
  if (questionsList.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-border rounded-xl">
        <Layers className="h-8 w-8 text-text-muted mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium text-text-primary">No classification rules configured</p>
        <p className="text-xs text-text-muted mt-1 mb-4">
          Add your first custom rule to begin fast classification.
        </p>
        <Button
          size="sm"
          onClick={onOpenAddRule}
          className="gap-1.5 bg-primary text-black hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Add Rule
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {questionsList.map((q) => (
        <div
          key={q.name}
          className="flex items-center justify-between p-3 px-4 rounded-xl border border-border/70 bg-bg-surface/60 hover:bg-bg-surface/90 hover:border-border transition-all gap-4 group"
        >
          {/* Left: Identifier + Type Badge */}
          <div className="flex items-center gap-2.5 min-w-[190px] shrink-0">
            <span className="text-xs font-mono font-bold text-text-primary">{q.name}</span>
            <span
              className={cn(
                "text-xs uppercase font-mono px-2 py-0.5 rounded-md font-semibold",
                q.type === "choice" && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                q.type === "score" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                q.type === "noul" && "bg-purple-500/10 text-purple-400 border border-purple-500/20",
              )}
            >
              {q.type}
            </span>
          </div>

          {/* Center: Instruction Prompt + Scope Tags */}
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <p className="text-xs text-text-muted truncate italic" title={q.instructions}>
              "{q.instructions}"
            </p>

            {q.type === "choice" && q.options && (
              <div className="hidden lg:flex items-center gap-1 shrink-0">
                {q.options.slice(0, 3).map((opt) => (
                  <span
                    key={opt}
                    className="text-xs font-mono bg-bg-surface-active px-1.5 py-0.5 rounded border border-border/50 text-text-muted truncate max-w-[100px]"
                  >
                    {opt}
                  </span>
                ))}
                {q.options.length > 3 && (
                  <span className="text-xs font-mono text-text-muted/60">
                    +{q.options.length - 3}
                  </span>
                )}
              </div>
            )}

            {q.type === "score" && q.rubric && (
              <div className="hidden lg:flex items-center gap-1 shrink-0">
                <span className="text-xs font-mono text-text-muted">Scale:</span>
                {q.rubric.map((lvl) => (
                  <span
                    key={lvl}
                    className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  >
                    {lvl}
                  </span>
                ))}
              </div>
            )}

            {q.type === "noul" && (
              <span className="hidden lg:inline text-xs font-mono text-purple-400/80 shrink-0">
                True / False Probability
              </span>
            )}
          </div>

          {/* Right: Actions (Edit & Delete) */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenEditRule(q)}
              className="h-7 w-7 text-text-muted hover:text-primary hover:bg-primary/10 transition-colors p-1 cursor-pointer"
              title="Edit rule"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDeleteRule(q.name)}
              className="h-7 w-7 text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors p-1 cursor-pointer"
              title="Delete rule"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
