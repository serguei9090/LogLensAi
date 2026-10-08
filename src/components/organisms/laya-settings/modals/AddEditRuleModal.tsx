import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QuestionType } from "@/types/laya";

export interface AddEditRuleModalProps {
  readonly isOpen: boolean;
  readonly editingRuleName: string | null;
  readonly ruleName: string;
  readonly ruleType: QuestionType;
  readonly ruleInstructions: string;
  readonly ruleOptions: string;
  readonly ruleRubric: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRuleNameChange: (val: string) => void;
  readonly onRuleTypeChange: (val: QuestionType) => void;
  readonly onRuleInstructionsChange: (val: string) => void;
  readonly onRuleOptionsChange: (val: string) => void;
  readonly onRuleRubricChange: (val: string) => void;
  readonly onSaveRule: () => void;
}

export function AddEditRuleModal({
  isOpen,
  editingRuleName,
  ruleName,
  ruleType,
  ruleInstructions,
  ruleOptions,
  ruleRubric,
  onOpenChange,
  onRuleNameChange,
  onRuleTypeChange,
  onRuleInstructionsChange,
  onRuleOptionsChange,
  onRuleRubricChange,
  onSaveRule,
}: Readonly<AddEditRuleModalProps>) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-text-primary">
            {editingRuleName ? `Edit Rule: ${editingRuleName}` : "Add Decision Rule"}
          </DialogTitle>
          <DialogDescription className="text-xs text-text-muted">
            {editingRuleName
              ? "Modify the prompt, primitive type, or options for this rule."
              : "Define a typed question for Laya to answer in a single forward pass."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-text-muted">Rule Identifier</label>
            <input
              type="text"
              placeholder="e.g. subsystem_failure"
              value={ruleName}
              onChange={(e) => onRuleNameChange(e.target.value)}
              className="w-full h-9 px-3 rounded-lg text-xs bg-bg-app border border-border text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-text-muted">Decision Primitive Type</label>
            <select
              value={ruleType}
              onChange={(e) => onRuleTypeChange(e.target.value as QuestionType)}
              className="w-full h-9 px-3 rounded-lg text-xs bg-bg-app border border-border text-text-primary focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="choice">Choice (Categorical classification)</option>
              <option value="score">Score (Ordinal rubric rating)</option>
              <option value="noul">Noul (Calibrated True/False)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-text-muted">Instruction Prompt</label>
            <textarea
              placeholder="e.g. Determine the primary subsystem responsible for this log event"
              value={ruleInstructions}
              onChange={(e) => onRuleInstructionsChange(e.target.value)}
              rows={2}
              className="w-full p-2.5 rounded-lg text-xs bg-bg-app border border-border text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          {ruleType === "choice" && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-text-muted">
                Options (comma-separated)
              </label>
              <input
                type="text"
                placeholder="database, network, auth, disk_io, application"
                value={ruleOptions}
                onChange={(e) => onRuleOptionsChange(e.target.value)}
                className="w-full h-9 px-3 rounded-lg text-xs bg-bg-app border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
          )}

          {ruleType === "score" && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-text-muted">
                Rubric Scale Levels (comma-separated integers)
              </label>
              <input
                type="text"
                placeholder="1, 2, 3, 4, 5"
                value={ruleRubric}
                onChange={(e) => onRuleRubricChange(e.target.value)}
                className="w-full h-9 px-3 rounded-lg text-xs bg-bg-app border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onSaveRule}
            className="text-xs bg-primary text-black hover:bg-primary/90"
          >
            {editingRuleName ? "Update Rule" : "Save Rule Checkpoint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
