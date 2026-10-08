import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Info, Sparkles, Zap } from "lucide-react";

export interface LayaGuideModalProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function LayaGuideModal({
  isOpen,
  onOpenChange,
}: Readonly<LayaGuideModalProps>) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] bg-bg-surface border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold text-text-primary">
              Laya System 1 Architecture & Smart Tagging
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-text-muted">
            Learn how Laya classifies Drain3 cluster templates locally on CPU with zero cloud costs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs text-text-muted leading-relaxed">
          <div className="p-3.5 rounded-xl bg-bg-app border border-border space-y-2">
            <div className="flex items-center gap-2 text-text-primary font-semibold text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Primary Role: Background Smart Cluster Tagging
            </div>
            <p>
              Laya runs as a background worker on your local CPU. When the Drain3 pattern miner
              discovers or updates log template patterns, Laya evaluates the template in ~30ms and
              saves structured triage tags directly into DuckDB:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-text-muted font-mono text-xs">
              <li>
                <strong className="text-text-primary">category</strong>: application, database,
                network, auth, disk_io, third_party
              </li>
              <li>
                <strong className="text-text-primary">severity</strong>: 1.0 (trivial) to 5.0
                (catastrophic)
              </li>
              <li>
                <strong className="text-text-primary">is_outage</strong>: whether the pattern
                reflects customer-facing service downtime
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-semibold text-text-primary uppercase tracking-wider text-xs font-mono">
              The 3 Decision Primitives
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-400">1. Choice</span>
                  <span className="text-xs font-mono uppercase bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">
                    Categorical
                  </span>
                </div>
                <p className="text-text-muted text-xs">
                  Selects exactly one label from a closed set of options (e.g. subsystem routing,
                  error classification).
                </p>
              </div>

              <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-amber-400">2. Score</span>
                  <span className="text-xs font-mono uppercase bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">
                    Ordinal Rubric
                  </span>
                </div>
                <p className="text-text-muted text-xs">
                  Rates severity or confidence against an integer rubric scale (e.g. 1 to 5),
                  computing an expected value.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-purple-400">3. Noul</span>
                  <span className="text-xs font-mono uppercase bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">
                    Calibrated Boolean
                  </span>
                </div>
                <p className="text-text-muted text-xs">
                  Produces a calibrated True / False probability (e.g. "Does this template
                  represent an outage?").
                </p>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
            <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
              <Info className="h-3.5 w-3.5" />
              How the LLM Uses Laya Tags
            </div>
            <p className="text-text-muted text-xs">
              Chat queries go directly to your configured LLM (Claude, GPT-4o, Ollama, etc.). The
              LLM receives Laya's cluster triage tags in its grounded context and through the{" "}
              <code className="text-primary font-mono text-xs">get_clusters</code> tool, allowing it
              to instantly identify failing subsystems without extra API tokens.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs bg-primary text-black hover:bg-primary/90"
          >
            Close Guide
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
